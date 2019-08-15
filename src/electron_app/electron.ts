import electron, {
  App,
  BrowserWindow,
  Dialog,
  Event as ElectronEvent,
  IpcMain,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  WebContents,
} from 'electron';
import fs from 'fs';
import {CancellationToken, autoUpdater} from 'electron-updater';
import path from 'path';
import openAboutWindow, {AboutWindowInfo} from 'about-window';
import getPort from 'get-port';
import pe from '@process-engine/process_engine_runtime';
import {homedir} from 'os';
import electronOidc from './electron-oidc';
import oidcConfig from './oidc-config';
import ReleaseChannel from '../services/release-channel-service/release-channel-service';
import {version as CurrentStudioVersion} from '../../package.json';
import {getDefaultPortList} from '../services/default-ports-module/default-ports-module';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class Main {
  private static ipcMain: IpcMain = electron.ipcMain;
  private static dialog: Dialog = electron.dialog;
  private static app: App = electron.app;

  private static browserWindow: BrowserWindow;
  private static releaseChannel: ReleaseChannel = new ReleaseChannel(CurrentStudioVersion);
  // If BPMN Studio was opened by double-clicking a .bpmn file, then the
  // following code tells the frontend the name and content of that file;
  // this 'get_opened_file' request is emmitted in src/main.ts.
  private static filePath: string;
  private static isInitialized: boolean = false;

  /**
   * This variable gets set when BPMN Studio is ready to work with Files that are
   * openend via double click.
   */
  private static fileOpenMainEvent: electron.Event;

  public static execute(): void {
    /**
     * Makes Main application a Single Instance Application.
     */
    Main.app.requestSingleInstanceLock();

    /**
     * Check if Main application got the Single Instance Lock.
     * true: This instance is the first instance.
     * false: This instance is the second instance.
     */
    const hasSingleInstanceLock = Main.app.hasSingleInstanceLock();

    if (hasSingleInstanceLock) {
      Main.initializeApplication();

      Main.startInternalProcessEngine();

      Main.app.on('second-instance', (event, argv, workingDirectory) => {
        const noArgumentsSet = argv[1] === undefined;

        if (noArgumentsSet) {
          return;
        }

        const argumentIsFilePath = argv[1].endsWith('.bpmn');
        const argumentIsSignInRedirect = argv[1].startsWith('bpmn-studio://signin-oidc');
        const argumentIsSignOutRedirect = argv[1].startsWith('bpmn-studio://signout-oidc');

        if (argumentIsFilePath) {
          const filePath = argv[1];
          Main.bringExistingInstanceToForeground();

          Main.answerOpenFileEvent(filePath);
        }

        const argumentContainsRedirect = argumentIsSignInRedirect || argumentIsSignOutRedirect;
        if (argumentContainsRedirect) {
          const redirectUrl = argv[1];

          Main.browserWindow.loadURL(`file://${__dirname}/../index.html`);
          Main.browserWindow.loadURL('/');

          electron.ipcMain.once('deep-linking-ready', (): void => {
            Main.browserWindow.webContents.send('deep-linking-request', redirectUrl);
          });
        }
      });
    } else {
      Main.app.quit();
    }
  }

  private static initializeApplication(): void {
    Main.app.on('ready', (): void => {
      Main.createMainWindow();
    });

    Main.app.on('activate', (): void => {
      if (Main.browserWindow === null) {
        Main.createMainWindow();
      }
    });

    if (!Main.releaseChannel.isDev()) {
      Main.initializeAutoUpdater();
    }

    Main.initializeFileOpenFeature();
    Main.initializeOidc();
  }

  private static initializeAutoUpdater(): void {
    electron.ipcMain.on('app_ready', async (appReadyEvent) => {
      autoUpdater.autoDownload = false;

      const currentVersion = Main.app.getVersion();
      const currentReleaseChannel = new ReleaseChannel(currentVersion);

      const currentVersionIsPrerelease = currentReleaseChannel.isAlpha() || currentReleaseChannel.isBeta();
      autoUpdater.allowPrerelease = currentVersionIsPrerelease;

      const updateCheckResult = await autoUpdater.checkForUpdates();

      const noUpdateAvailable = updateCheckResult.updateInfo.version === currentVersion;
      if (noUpdateAvailable) {
        return;
      }

      const newReleaseChannel = new ReleaseChannel(updateCheckResult.updateInfo.version);

      if (currentVersionIsPrerelease) {
        if (currentReleaseChannel.isAlpha() && !newReleaseChannel.isAlpha()) {
          return;
        }

        if (currentReleaseChannel.isBeta() && !newReleaseChannel.isBeta()) {
          return;
        }
      }

      console.log(`CurrentVersion: ${currentVersion}, CurrentVersionIsPrerelease: ${currentVersionIsPrerelease}`);

      autoUpdater.addListener('error', () => {
        appReadyEvent.sender.send('update_error');
      });

      autoUpdater.addListener('download-progress', (progressObj) => {
        const progressInPercent = progressObj.percent / 100;

        Main.browserWindow.setProgressBar(progressInPercent);

        appReadyEvent.sender.send('update_download_progress', progressObj);
      });

      let downloadCancellationToken;

      autoUpdater.addListener('update-available', (updateInfo) => {
        appReadyEvent.sender.send('update_available', updateInfo.version);

        electron.ipcMain.on('download_update', () => {
          downloadCancellationToken = new CancellationToken();
          autoUpdater.downloadUpdate(downloadCancellationToken);

          electron.ipcMain.on('cancel_update', () => {
            downloadCancellationToken.cancel();
          });
        });

        electron.ipcMain.on('show_release_notes', () => {
          const releaseNotesWindow = new electron.BrowserWindow({
            width: 600,
            height: 600,
            title: `Release Notes ${updateInfo.version}`,
            minWidth: 600,
            minHeight: 600,
          });

          releaseNotesWindow.loadURL(
            `https://github.com/process-engine/bpmn-studio/releases/tag/v${updateInfo.version}`,
          );
        });
      });

      autoUpdater.addListener('update-downloaded', () => {
        appReadyEvent.sender.send('update_downloaded');

        electron.ipcMain.on('quit_and_install', () => {
          autoUpdater.quitAndInstall();
        });
      });

      autoUpdater.checkForUpdates();
    });
  }

  /**
   * This initializes the oidc flow for electron.
   * It mainly registers on the "oidc-login" event called by the authentication
   * service and calls the "getTokenObject"-function on the service.
   */
  private static initializeOidc(): void {
    const windowParams = {
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
      },
    };

    const electronOidcInstance = electronOidc(oidcConfig, windowParams);

    Main.ipcMain.on('oidc-login', (event, authorityUrl) => {
      electronOidcInstance.getTokenObject(authorityUrl).then(
        (token) => {
          event.sender.send('oidc-login-reply', token);
        },
        (err) => {
          console.log('Error while getting token', err);
        },
      );
    });

    Main.ipcMain.on('oidc-logout', (event, tokenObject, authorityUrl) => {
      electronOidcInstance.logout(tokenObject, authorityUrl).then(
        (logoutWasSuccessful) => {
          event.sender.send('oidc-logout-reply', logoutWasSuccessful);
        },
        (err) => {
          console.log('Error while logging out', err);
        },
      );
    });
  }

  private static initializeFileOpenFeature(): void {
    Main.app.on('window-all-closed', () => {
      Main.app.quit();
      Main.filePath = undefined;
    });

    Main.app.on('will-finish-launching', () => {
      // for windows
      if (process.platform === 'win32' && process.argv.length >= 2) {
        Main.filePath = process.argv[1];
      }

      // for non-windows
      Main.app.on('open-file', (event, filePath) => {
        Main.filePath = Main.isInitialized ? undefined : filePath;

        if (Main.isInitialized) {
          Main.answerOpenFileEvent(filePath);
        }
      });
    });

    /**
     * Wait for the "waiting"-event signalling the app has started and the
     * component is ready to handle events.
     *
     * Set the fileOpenMainEvent variable to make it accesable by the sending
     * function "answerOpenFileEvent".
     *
     * Register an "open-file"-listener to get the path to file which has been
     * clicked on.
     *
     * "open-file" gets fired when someone double clicks a .bpmn file.
     */
    electron.ipcMain.on('waiting-for-double-file-click', (mainEvent: ElectronEvent) => {
      Main.fileOpenMainEvent = mainEvent;
      Main.isInitialized = true;
    });

    electron.ipcMain.on('get_opened_file', (event) => {
      const filePathExists: boolean = Main.filePath === undefined;
      if (filePathExists) {
        event.returnValue = {};
        return;
      }

      event.returnValue = {
        path: Main.filePath,
        content: fs.readFileSync(Main.filePath, 'utf8'),
      };

      Main.filePath = undefined;
      Main.app.focus();
    });
  }

  private static answerOpenFileEvent(filePath: string): void {
    Main.fileOpenMainEvent.sender.send('double-click-on-file', filePath);
  }

  private static getProductName(): string {
    switch (Main.releaseChannel.getName()) {
      case 'stable':
        return 'BPMN Studio';
      case 'beta':
        return 'BPMN Studio (Beta)';
      case 'alpha':
        return 'BPMN Studio (Alpha)';
      case 'dev':
        return 'BPMN Studio (Dev)';
      default:
        return 'BPMN Studio (pre)';
    }
  }

  private static createMainWindow(): void {
    console.log('create window called');

    Main.setElectronMenubar();

    Main.browserWindow = new BrowserWindow({
      width: 1300,
      height: 800,
      title: Main.getProductName(),
      minWidth: 1300,
      minHeight: 800,
      icon: path.join(__dirname, '../build/icon.png'), // only for windows
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: true,
      },
    });

    Main.browserWindow.loadURL(`file://${__dirname}/../index.html`);
    // We need to navigate to "/" because something in the push state seems to be
    // broken if we carry a file system link as the last item of the browser
    // history.
    Main.browserWindow.loadURL('/');

    electron.ipcMain.on('close_bpmn-studio', (event) => {
      Main.browserWindow.close();
    });

    Main.browserWindow.on('closed', (event) => {
      Main.browserWindow = null;
    });

    Main.setOpenDiagramListener();
    Main.setOpenSolutionsListener();
    Main.setSaveDiagramAsListener();

    const platformIsWindows = process.platform === 'win32';
    if (platformIsWindows) {
      Main.browserWindow.webContents.session.on('will-download', (event, downloadItem) => {
        const defaultFilename = downloadItem.getFilename();

        const fileTypeIndex = defaultFilename.lastIndexOf('.') + 1;
        const fileExtension = defaultFilename.substring(fileTypeIndex);

        const fileExtensionIsBPMN = fileExtension === 'bpmn';
        const fileType = fileExtensionIsBPMN ? 'BPMN (.bpmn)' : `Image (.${fileExtension})`;

        const filename = Main.dialog.showSaveDialog({
          defaultPath: defaultFilename,
          filters: [
            {
              name: fileType,
              extensions: [fileExtension],
            },
            {
              name: 'All Files',
              extensions: ['*'],
            },
          ],
        });

        const downloadCanceled = filename === undefined;
        if (downloadCanceled) {
          downloadItem.cancel();

          return;
        }

        downloadItem.setSavePath(filename);
      });
    }
  }

  private static setSaveDiagramAsListener(): void {
    electron.ipcMain.on('open_save-diagram-as_dialog', (event) => {
      const filePath = Main.dialog.showSaveDialog({
        filters: [
          {
            name: 'BPMN',
            extensions: ['bpmn', 'xml'],
          },
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
      });

      event.sender.send('save_diagram_as', filePath);
    });
  }

  private static setOpenDiagramListener(): void {
    electron.ipcMain.on('open_diagram', (event) => {
      const openedFile = Main.dialog.showOpenDialog({
        filters: [
          {
            name: 'BPMN',
            extensions: ['bpmn', 'xml'],
          },
          {
            name: 'XML',
            extensions: ['bpmn', 'xml'],
          },
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
      });

      event.sender.send('import_opened_diagram', openedFile);
    });
  }

  private static setOpenSolutionsListener(): void {
    electron.ipcMain.on('open_solution', (event) => {
      const openedFile = Main.dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });

      event.sender.send('import_opened_solution', openedFile);
    });
  }

  private static setElectronMenubar(): void {
    Main.showMenuEntriesWithoutDiagramEntries();

    electron.ipcMain.on('menu_hide-diagram-entries', () => {
      Main.showMenuEntriesWithoutDiagramEntries();
    });

    electron.ipcMain.on('menu_show-all-menu-entries', () => {
      Main.showAllMenuEntries();
    });
  }

  private static showAllMenuEntries(): void {
    const template = [
      Main.getApplicationMenu(),
      Main.getFileMenu(),
      Main.getEditMenu(),
      Main.getWindowMenu(),
      Main.getHelpMenu(),
    ];

    electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
  }

  private static showMenuEntriesWithoutDiagramEntries(): void {
    let previousEntryIsSeparator = false;

    const fileMenu = Main.getFileMenu();
    const filteredFileSubmenuItems = fileMenu.submenu.items.filter((submenuEntry: MenuItem) => {
      const isSeparator = submenuEntry.type !== undefined && submenuEntry.type === 'separator';
      if (isSeparator) {
        // This is used to prevent double separators
        if (previousEntryIsSeparator) {
          return false;
        }

        previousEntryIsSeparator = true;
        return true;
      }

      const isSaveButton = submenuEntry.label !== undefined && submenuEntry.label.startsWith('Save');
      if (isSaveButton) {
        return false;
      }

      previousEntryIsSeparator = false;
      return true;
    });
    fileMenu.submenu.items = filteredFileSubmenuItems;

    const template = [
      Main.getApplicationMenu(),
      fileMenu,
      Main.getEditMenu(),
      Main.getWindowMenu(),
      Main.getHelpMenu(),
    ];

    electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
  }

  private static getApplicationMenu(): MenuItem {
    const submenuOptions: Array<MenuItemConstructorOptions> = [
      {
        label: `About ${Main.getProductName()}`,
        click: (): void => {
          openAboutWindow(Main.getAboutWindowInfo());
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit',
        role: 'quit',
      },
    ];
    const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

    const menuOptions: MenuItemConstructorOptions = {
      label: Main.getProductName(),
      submenu: submenu,
    };

    return new MenuItem(menuOptions);
  }

  private static getFileMenu(): MenuItem {
    const submenuOptions: Array<MenuItemConstructorOptions> = [
      {
        label: 'New Diagram',
        accelerator: 'CmdOrCtrl+N',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_create_diagram');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Open Diagram',
        accelerator: 'CmdOrCtrl+O',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_opening_diagram');
        },
      },
      {
        label: 'Open Solution',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_opening_solution');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Save Diagram',
        accelerator: 'CmdOrCtrl+S',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_save_diagram');
        },
      },
      {
        label: 'Save Diagram As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_save_diagram_as');
        },
      },
      {
        label: 'Save All Diagrams',
        accelerator: 'CmdOrCtrl+Alt+S',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_save_all_diagrams');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Close Diagram',
        accelerator: 'CmdOrCtrl+W',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_close_diagram');
        },
      },
      {
        label: 'Close All Diagrams',
        accelerator: 'CmdOrCtrl+Alt+W',
        click: (): void => {
          Main.browserWindow.webContents.send('menubar__start_close_all_diagrams');
        },
      },
    ];
    const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

    const menuOptions: MenuItemConstructorOptions = {
      label: 'File',
      submenu: submenu,
    };

    return new MenuItem(menuOptions);
  }

  private static getEditMenu(): MenuItem {
    const submenuOptions: Array<MenuItemConstructorOptions> = [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo',
      },
      {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        role: 'redo',
      },
      {
        type: 'separator',
      },
      {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut',
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy',
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste',
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectall',
      },
    ];

    const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

    const menuOptions: MenuItemConstructorOptions = {
      label: 'Edit',
      submenu: submenu,
    };

    return new MenuItem(menuOptions);
  }

  private static getWindowMenu(): MenuItem {
    const submenuOptions: Array<MenuItemConstructorOptions> = [
      {
        role: 'minimize',
      },
      {
        role: 'close',
      },
      {
        type: 'separator',
      },
      {
        role: 'reload',
      },
      {
        role: 'toggledevtools',
      },
    ];

    const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

    const menuOptions: MenuItemConstructorOptions = {
      label: 'Window',
      submenu: submenu,
    };

    return new MenuItem(menuOptions);
  }

  private static getHelpMenu(): MenuItem {
    const submenuOptions: Array<MenuItemConstructorOptions> = [
      {
        label: 'Getting Started',
        click: (): void => {
          const documentationUrl = 'https://www.process-engine.io/docs/getting-started/';
          electron.shell.openExternal(documentationUrl);
        },
      },
      {
        label: 'Release Notes for Current Version',
        click: (): void => {
          const currentVersion = electron.app.getVersion();
          const currentReleaseNotesUrl = `https://github.com/process-engine/bpmn-studio/releases/tag/v${currentVersion}`;
          electron.shell.openExternal(currentReleaseNotesUrl);
        },
      },
    ];

    const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

    const menuOptions: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: submenu,
    };

    return new MenuItem(menuOptions);
  }

  private static getAboutWindowInfo(): AboutWindowInfo {
    const iconPath: string = Main.releaseChannel.isDev()
      ? path.join(__dirname, '..', 'build/icon.png')
      : path.join(__dirname, '../../../build/icon.png');
    const copyrightYear: number = new Date().getFullYear();

    return {
      icon_path: iconPath,
      product_name: Main.getProductName(),
      bug_report_url: 'https://github.com/process-engine/bpmn-studio/issues/new',
      homepage: 'www.process-engine.io',
      copyright: `Copyright © ${copyrightYear} process-engine`,
      win_options: {
        minimizable: false,
        maximizable: false,
        resizable: false,
      },
      package_json_dir: __dirname,
    };
  }

  private static async startInternalProcessEngine(): Promise<any> {
    const devUserDataFolderPath = path.join(__dirname, '..', 'userData');
    const prodUserDataFolderPath = Main.app.getPath('userData');

    const userDataFolderPath = Main.releaseChannel.isDev() ? devUserDataFolderPath : prodUserDataFolderPath;

    if (!Main.releaseChannel.isDev()) {
      process.env.CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'config');
    }

    const configForGetPort = {
      port: getDefaultPortList(),
      host: '0.0.0.0',
    };
    console.log('Trying to start internal ProcessEngine on ports:', configForGetPort);

    const port = await getPort(configForGetPort);

    console.log(`Internal ProcessEngine starting on port ${port}.`);

    process.env.http__http_extension__server__port = `${port}`;

    const processEngineDatabaseFolderName = 'process_engine_databases';

    process.env.process_engine__process_model_repository__storage = path.join(
      userDataFolderPath,
      processEngineDatabaseFolderName,
      'process_model.sqlite',
    );
    process.env.process_engine__flow_node_instance_repository__storage = path.join(
      userDataFolderPath,
      processEngineDatabaseFolderName,
      'flow_node_instance.sqlite',
    );
    process.env.process_engine__timer_repository__storage = path.join(
      userDataFolderPath,
      processEngineDatabaseFolderName,
      'timer.sqlite',
    );

    const processEngineStatusListeners = [];
    let internalProcessEngineStatus;
    let internalProcessEngineStartupError;

    /* When someone wants to know to the internal processengine status, he
     * must first send a `add_internal_processengine_status_listener` message
     * to the event mechanism. We recieve this message here and add the sender
     * to our listeners array.
     *
     * As soon, as the processengine status is updated, we send the listeners a
     * notification about this change; this message contains the state and the
     * error text (if there was an error).
     *
     * If the processengine status is known by the time the listener registers,
     * we instantly respond to the listener with a notification message.
     *
     * This is quite a unusual pattern, the problem this approves solves is the
     * following: It's impossible to do interactions between threads in
     * electron like this:
     *
     *  'renderer process'              'main process'
     *          |                             |
     *          o   <<<- Send Message  -<<<   x
     *
     * -------------------------------------------------
     *
     * Instead our interaction now locks like this:
     *
     *  'renderer process'              'main process'
     *          |                             |
     *          x   >>>--  Subscribe  -->>>   o
     *          o   <<<- Send Message  -<<<   x
     *          |       (event occurs)        |
     *          o   <<<- Send Message  -<<<   x
     */
    electron.ipcMain.on('add_internal_processengine_status_listener', (event: ElectronEvent) => {
      if (!processEngineStatusListeners.includes(event.sender)) {
        processEngineStatusListeners.push(event.sender);
      }

      if (internalProcessEngineStatus !== undefined) {
        Main.sendInternalProcessEngineStatus(
          event.sender,
          internalProcessEngineStatus,
          internalProcessEngineStartupError,
        );
      }
    });

    // This tells the frontend the location at which the electron-skeleton
    // will be running; this 'get_host' request ist emitted in src/main.ts.
    electron.ipcMain.on('get_host', (event: ElectronEvent) => {
      event.returnValue = `localhost:${port}`;
    });

    // TODO: Check if the ProcessEngine instance is now run on the UI thread.
    // See issue https://github.com/process-engine/bpmn-studio/issues/312
    try {
      const sqlitePath = path.join(Main.getConfigFolder(), processEngineDatabaseFolderName);

      // eslint-disable-next-line global-require
      pe.startRuntime(sqlitePath);

      console.log('Internal ProcessEngine started successfully.');
      internalProcessEngineStatus = 'success';

      Main.publishProcessEngineStatus(
        processEngineStatusListeners,
        internalProcessEngineStatus,
        internalProcessEngineStartupError,
      );
    } catch (error) {
      console.error('Failed to start internal ProcessEngine: ', error);
      internalProcessEngineStatus = 'error';
      internalProcessEngineStartupError = error;

      Main.publishProcessEngineStatus(
        processEngineStatusListeners,
        internalProcessEngineStatus,
        internalProcessEngineStartupError,
      );
    }
  }

  private static sendInternalProcessEngineStatus(
    sender: WebContents,
    internalProcessEngineStatus,
    internalProcessEngineStartupError,
  ): any {
    let serializedStartupError;
    const processEngineStartSuccessful =
      internalProcessEngineStartupError !== undefined && internalProcessEngineStartupError !== null;

    if (processEngineStartSuccessful) {
      serializedStartupError = JSON.stringify(
        internalProcessEngineStartupError,
        Object.getOwnPropertyNames(internalProcessEngineStartupError),
      );
    } else {
      serializedStartupError = undefined;
    }

    sender.send('internal_processengine_status', internalProcessEngineStatus, serializedStartupError);
  }

  private static publishProcessEngineStatus(
    processEngineStatusListeners,
    internalProcessEngineStatus,
    internalProcessEngineStartupError,
  ): void {
    processEngineStatusListeners.forEach((processEngineStatusLisener) => {
      Main.sendInternalProcessEngineStatus(
        processEngineStatusLisener,
        internalProcessEngineStatus,
        internalProcessEngineStartupError,
      );
    });
  }

  private static getConfigFolder(): string {
    const configPath = `bpmn-studio${Main.getConfigPathSuffix()}`;

    return path.join(Main.getUserConfigFolder(), configPath);
  }

  private static getConfigPathSuffix(): string {
    if (Main.releaseChannel.isDev()) {
      return '-dev';
    }
    if (Main.releaseChannel.isAlpha()) {
      return '-alpha';
    }
    if (Main.releaseChannel.isBeta()) {
      return '-beta';
    }
    if (Main.releaseChannel.isStable()) {
      return '';
    }

    throw new Error('Could not get config path suffix for internal process engine');
  }

  private static getUserConfigFolder(): string {
    const userHomeDir = homedir();

    switch (process.platform) {
      case 'darwin':
        return path.join(userHomeDir, 'Library', 'Application Support');
      case 'win32':
        return path.join(userHomeDir, 'AppData', 'Roaming');
      default:
        return path.join(userHomeDir, '.config');
    }
  }

  private static bringExistingInstanceToForeground(): void {
    if (Main.browserWindow) {
      if (Main.browserWindow.isMinimized()) {
        Main.browserWindow.restore();
      }

      Main.browserWindow.focus();
    }
  }
}
Main.execute();
