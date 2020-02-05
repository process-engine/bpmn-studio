/* eslint-disable max-lines */
import fs from 'fs';
import path from 'path';
import {homedir} from 'os';
import {ChildProcess, fork} from 'child_process';

import windowStateKeeper from 'electron-window-state';
import JSZip from 'jszip';
import {
  App,
  BrowserWindow,
  Dialog,
  IpcMain,
  IpcMainEvent,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  WebContents,
} from 'electron';
import openAboutWindow, {AboutWindowInfo} from 'about-window';
import getPort from 'get-port';
import open from 'open';

import {CancellationToken, autoUpdater} from '@process-engine/electron-updater';
import {version as ProcessEngineVersion} from '@process-engine/process_engine_runtime/package.json';

import ReleaseChannel from '../src/services/release-channel-service/release-channel.service';
import {solutionIsRemoteSolution} from '../src/services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {version as CurrentStudioVersion} from '../package.json';
import {getPortListByVersion} from '../src/services/default-ports-module/default-ports.module';
import {FeedbackData} from '../src/contracts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
import electron = require('electron');

const ipcMain: IpcMain = electron.ipcMain;
const dialog: Dialog = electron.dialog;
const app: App = electron.app;

let browserWindow: BrowserWindow;
const releaseChannel: ReleaseChannel = new ReleaseChannel(CurrentStudioVersion);
// If BPMN Studio was opened by double-clicking a .bpmn file, then the
// following code tells the frontend the name and content of that file;
// this 'get_opened_file' request is emmitted in src/main.ts.
let fileAssociationFilePath: string;
let isInitialized: boolean = false;

let peErrors: string = '';

/**
 * This variable gets set when BPMN Studio is ready to work with Files that are
 * openend via double click.
 */
let fileOpenMainEvent: IpcMainEvent;

let runtimeProcess: ChildProcess;

process.on('exit', () => {
  if (runtimeProcess) {
    runtimeProcess.kill('SIGTERM');
  }
});

function execute(): void {
  /**
   * Makes Main application a Single Instance Application.
   */
  app.requestSingleInstanceLock();

  /**
   * Check if Main application got the Single Instance Lock.
   * true: This instance is the first instance.
   * false: This instance is the second instance.
   */
  const hasSingleInstanceLock = app.hasSingleInstanceLock();

  if (hasSingleInstanceLock) {
    initializeApplication();

    startInternalProcessEngine();

    app.on('second-instance', (event, argv, workingDirectory) => {
      const noArgumentsSet = argv[1] === undefined;

      if (noArgumentsSet) {
        return;
      }

      const argumentIsFilePath = argv[1].endsWith('.bpmn');
      const argumentIsSignInRedirect = argv[1].startsWith('bpmn-studio://signin-oidc');
      const argumentIsSignOutRedirect = argv[1].startsWith('bpmn-studio://signout-oidc');

      if (argumentIsFilePath) {
        const filePath = argv[1];
        bringExistingInstanceToForeground();

        answerOpenFileEvent(filePath);
      }

      const argumentContainsRedirect = argumentIsSignInRedirect || argumentIsSignOutRedirect;
      if (argumentContainsRedirect) {
        const redirectUrl = argv[1];

        browserWindow.loadURL(`file://${__dirname}/../../../index.html`);
        browserWindow.loadURL('/');

        ipcMain.once('deep-linking-ready', (): void => {
          browserWindow.webContents.send('deep-linking-request', redirectUrl);
        });
      }
    });
  } else {
    app.quit();
  }
}

function initializeApplication(): void {
  app.on('ready', (): void => {
    createMainWindow();
  });

  app.on('activate', (): void => {
    if (browserWindow === undefined) {
      createMainWindow();
    }
  });

  ipcMain.on('restart', (): void => {
    app.relaunch();
    app.quit();
  });

  ipcMain.on('isDevelop', (event) => {
    event.sender.send('isDevelop', releaseChannel.isDev());
  });

  ipcMain.on('create-feedback-zip', async (event, feedbackData: FeedbackData) => {
    createFeedbackZip(feedbackData);
  });

  if (!releaseChannel.isDev() && !process.env.SPECTRON_TESTS) {
    initializeAutoUpdater();
  }

  initializeFileOpenFeature();
}

function initializeAutoUpdater(): void {
  ipcMain.on('app_ready', async (appReadyEvent) => {
    autoUpdater.autoDownload = false;

    const currentVersion = app.getVersion();
    const currentReleaseChannel = new ReleaseChannel(currentVersion);

    const currentVersionIsPrerelease = currentReleaseChannel.isAlpha() || currentReleaseChannel.isBeta();
    autoUpdater.allowPrerelease = currentVersionIsPrerelease;
    autoUpdater.channel = currentReleaseChannel.getName();

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

    autoUpdater.addListener('error', (error) => {
      appReadyEvent.sender.send('update_error', error.message);
    });

    autoUpdater.addListener('download-progress', (progressObj) => {
      const progressInPercent = progressObj.percent / 100;

      browserWindow.setProgressBar(progressInPercent);

      appReadyEvent.sender.send('update_download_progress', progressObj);
    });

    let downloadCancellationToken;

    autoUpdater.addListener('update-available', (updateInfo) => {
      appReadyEvent.sender.send('update_available', updateInfo.version);

      ipcMain.on('download_update', () => {
        downloadCancellationToken = new CancellationToken();
        autoUpdater.downloadUpdate(downloadCancellationToken);

        ipcMain.on('cancel_update', () => {
          downloadCancellationToken.cancel();
        });
      });

      ipcMain.on('show_release_notes', () => {
        const releaseNotesWindow = new BrowserWindow({
          width: 600,
          height: 600,
          title: `Release Notes ${updateInfo.version}`,
          minWidth: 600,
          minHeight: 600,
        });

        releaseNotesWindow.loadURL(`https://github.com/process-engine/bpmn-studio/releases/tag/v${updateInfo.version}`);
      });
    });

    autoUpdater.addListener('update-downloaded', () => {
      appReadyEvent.sender.send('update_downloaded');

      ipcMain.on('quit_and_install', () => {
        autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.checkForUpdates();
  });
}

function initializeFileOpenFeature(): void {
  app.on('window-all-closed', () => {
    app.quit();
    fileAssociationFilePath = undefined;
  });

  app.on('will-finish-launching', () => {
    // for windows
    if (process.platform === 'win32' && process.argv.length >= 2 && process.argv[1].endsWith('.bpmn')) {
      fileAssociationFilePath = process.argv[1];
    }

    // for non-windows
    app.on('open-file', (event, filePath) => {
      fileAssociationFilePath = isInitialized ? undefined : filePath;

      if (isInitialized) {
        answerOpenFileEvent(filePath);
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
  ipcMain.on('waiting-for-double-file-click', (mainEvent: IpcMainEvent) => {
    fileOpenMainEvent = mainEvent;
    isInitialized = true;
  });

  ipcMain.on('get_opened_file', (event) => {
    const filePathExists: boolean = fileAssociationFilePath === undefined;
    if (filePathExists) {
      event.returnValue = {};
      return;
    }

    event.returnValue = {
      path: fileAssociationFilePath,
      content: fs.readFileSync(fileAssociationFilePath, 'utf8'),
    };

    fileAssociationFilePath = undefined;
    app.focus();
  });
}

function answerOpenFileEvent(filePath: string): void {
  fileOpenMainEvent.sender.send('double-click-on-file', filePath);
}

function getProductName(): string {
  switch (releaseChannel.getName()) {
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

function createMainWindow(): void {
  console.log('create window called');

  setElectronMenubar();

  const mainWindowState = windowStateKeeper({
    defaultWidth: 1300,
    defaultHeight: 800,
  });

  browserWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    title: getProductName(),
    minWidth: 1300,
    minHeight: 800,
    show: false,
    backgroundColor: '#f7f7f7',
    icon: path.join(__dirname, '../build/icon.png'), // only for windows
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindowState.manage(browserWindow);

  browserWindow.on('ready-to-show', () => {
    browserWindow.show();
  });

  browserWindow.loadURL(`file://${__dirname}/../../../index.html`);
  // We need to navigate to "/" because something in the push state seems to be
  // broken if we carry a file system link as the last item of the browser
  // history.
  browserWindow.loadURL('/');

  ipcMain.on('close_bpmn-studio', (event) => {
    browserWindow.close();
  });

  browserWindow.on('closed', (event) => {
    browserWindow = null;
  });

  browserWindow.on('enter-full-screen', () => {
    browserWindow.webContents.send('toggle-fullscreen', true);
  });
  browserWindow.on('leave-full-screen', () => {
    browserWindow.webContents.send('toggle-fullscreen', false);
  });

  browserWindow.webContents.on('new-window', (event: any, url: string) => {
    if (url !== browserWindow.webContents.getURL()) {
      event.preventDefault();
      open(url);
    }
  });

  setOpenDiagramListener();
  setOpenSolutionsListener();
  setSaveDiagramAsListener();

  const platformIsWindows = process.platform === 'win32';
  if (platformIsWindows) {
    browserWindow.webContents.session.on('will-download', (event, downloadItem) => {
      const defaultFilename = downloadItem.getFilename();

      const fileExtension = path.extname(defaultFilename);
      const fileExtensionIsBPMN = fileExtension === 'bpmn';
      const fileType = fileExtensionIsBPMN ? 'BPMN (.bpmn)' : `Image (${fileExtension})`;

      downloadItem.setSaveDialogOptions({
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
    });
  }
}

function setSaveDiagramAsListener(): void {
  ipcMain.on('open_save-diagram-as_dialog', async (event) => {
    const saveDialogResult = await dialog.showSaveDialog({
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

    const filePath: string = saveDialogResult.canceled ? undefined : saveDialogResult.filePath;

    event.sender.send('save_diagram_as', filePath);
  });
}

function setOpenDiagramListener(): void {
  ipcMain.on('open_diagram', (event) => {
    const openedFile = dialog.showOpenDialogSync({
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

function setOpenSolutionsListener(): void {
  ipcMain.on('open_solution', (event) => {
    const openedFile = dialog.showOpenDialogSync({
      properties: ['openDirectory', 'createDirectory'],
    });

    event.sender.send('import_opened_solution', openedFile);
  });
}

function setElectronMenubar(): void {
  showFilteredMenuEntries(false, false);

  ipcMain.on('menu_hide-diagram-related-entries', () => {
    showFilteredMenuEntries(false, false);
  });

  ipcMain.on('menu_hide-save-entries', () => {
    showFilteredMenuEntries(false, true);
  });

  ipcMain.on('menu_show-all-menu-entries', () => {
    showAllMenuEntries();
  });
}

function showAllMenuEntries(): void {
  const template = [getApplicationMenu(), getFileMenu(), getEditMenu(), getWindowMenu(), getHelpMenu()];

  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
}

function showFilteredMenuEntries(showSaveButtons: boolean, showExportButton: boolean): void {
  const filteredFileMenu: MenuItem = getFilteredFileMenu(showSaveButtons, showExportButton);

  const template = [getApplicationMenu(), filteredFileMenu, getEditMenu(), getWindowMenu(), getHelpMenu()];

  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
}

function getFilteredFileMenu(showSaveButtons: boolean, showExportButton: boolean): MenuItem {
  let previousEntryIsSeparator = false;

  const unfilteredFileMenu = getFileMenu();
  const filteredFileSubmenuItems = unfilteredFileMenu.submenu.items.filter((submenuEntry: MenuItem) => {
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
    if (isSaveButton && !showSaveButtons) {
      return false;
    }

    const isExportButton = submenuEntry.label !== undefined && submenuEntry.label.startsWith('Export');
    if (isExportButton && !showExportButton) {
      return false;
    }

    previousEntryIsSeparator = false;
    return true;
  });
  const newFileSubmenu: Menu = electron.Menu.buildFromTemplate(filteredFileSubmenuItems);

  const menuOptions: MenuItemConstructorOptions = {
    label: 'File',
    submenu: newFileSubmenu,
  };

  return new MenuItem(menuOptions);
}

function getApplicationMenu(): MenuItem {
  const submenuOptions: Array<MenuItemConstructorOptions> = [
    {
      label: `About ${getProductName()}`,
      click: (): void => {
        openAboutWindow(getAboutWindowInfo());
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Preferences',
      click: (): void => {
        browserWindow.webContents.send('menubar__open_preferences');
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
    label: getProductName(),
    submenu: submenu,
  };

  return new MenuItem(menuOptions);
}

function getFileMenu(): MenuItem {
  const submenuOptions: Array<MenuItemConstructorOptions> = [
    {
      label: 'New Diagram',
      accelerator: 'CmdOrCtrl+N',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_create_diagram');
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Open Diagram',
      accelerator: 'CmdOrCtrl+O',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_opening_diagram');
      },
    },
    {
      label: 'Open Solution',
      accelerator: 'CmdOrCtrl+Shift+O',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_opening_solution');
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Save Diagram',
      accelerator: 'CmdOrCtrl+S',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_save_diagram');
      },
    },
    {
      label: 'Save Diagram As...',
      accelerator: 'CmdOrCtrl+Shift+S',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_save_diagram_as');
      },
    },
    {
      label: 'Save All Diagrams',
      accelerator: 'CmdOrCtrl+Alt+S',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_save_all_diagrams');
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Export Diagram As...',
      submenu: [
        {
          label: 'BPMN',
          click: (): void => {
            browserWindow.webContents.send('menubar__epxort_diagram_as', 'BPMN');
          },
        },
        {
          label: 'SVG',
          click: (): void => {
            browserWindow.webContents.send('menubar__epxort_diagram_as', 'SVG');
          },
        },
        {
          label: 'PNG',
          click: (): void => {
            browserWindow.webContents.send('menubar__epxort_diagram_as', 'PNG');
          },
        },
        {
          label: 'JPEG',
          click: (): void => {
            browserWindow.webContents.send('menubar__epxort_diagram_as', 'JPEG');
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Close Diagram',
      accelerator: 'CmdOrCtrl+W',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_close_diagram');
      },
    },
    {
      label: 'Close All Diagrams',
      accelerator: 'CmdOrCtrl+Alt+W',
      click: (): void => {
        browserWindow.webContents.send('menubar__start_close_all_diagrams');
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

function getEditMenu(): MenuItem {
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
      role: 'selectAll',
    },
  ];

  const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

  const menuOptions: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: submenu,
  };

  return new MenuItem(menuOptions);
}

function getWindowMenu(): MenuItem {
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
  ];

  const submenu: Menu = electron.Menu.buildFromTemplate(submenuOptions);

  const menuOptions: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: submenu,
  };

  return new MenuItem(menuOptions);
}

function getHelpMenu(): MenuItem {
  const submenuOptions: Array<MenuItemConstructorOptions> = [
    {
      label: 'Getting Started',
      click: (): void => {
        const documentationUrl = 'https://www.process-engine.io/docs/getting-started/';
        electron.shell.openExternal(documentationUrl);
      },
    },
    {
      label: 'BPMN Element Documentation',
      click: (): void => {
        const currentVersionBranch = getBranchOfCurrentVersion();
        const elementDocumentationUrl = `https://github.com/process-engine/bpmn-studio/blob/${currentVersionBranch}/doc/bpmn-elements.md`;

        electron.shell.openExternal(elementDocumentationUrl);
      },
    },
    {
      label: 'Release Notes',
      click: (): void => {
        const currentVersion = app.getVersion();
        const currentReleaseNotesUrl = `https://github.com/process-engine/bpmn-studio/releases/tag/v${currentVersion}`;
        electron.shell.openExternal(currentReleaseNotesUrl);
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Developer Support',
      submenu: [
        {
          role: 'toggleDevTools',
        },
        {
          type: 'separator',
        },
        {
          label: 'Export Databases to ZIP File ...',
          click: async (): Promise<void> => {
            try {
              await exportDatabases();
            } catch (error) {
              browserWindow.webContents.send('database-export-error', error.message);
            }
          },
        },
        {
          label: 'Open Folder for Databases',
          click: async (): Promise<void> => {
            electron.shell.openItem(getConfigFolder());
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Feedback',
      click: (): void => {
        browserWindow.webContents.send('show-feedback-modal');
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

function getAboutWindowInfo(): AboutWindowInfo {
  const copyrightYear: number = new Date().getFullYear();

  return {
    icon_path: releaseChannel.isDev()
      ? path.join(__dirname, '../../../build/icon.png')
      : path.join(__dirname, '../../../../../build/icon.png'),
    product_name: getProductName(),
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

async function startInternalProcessEngine(): Promise<any> {
  const devUserDataFolderPath = path.join(__dirname, '..', 'userData');
  const prodUserDataFolderPath = app.getPath('userData');

  const userDataFolderPath = releaseChannel.isDev() ? devUserDataFolderPath : prodUserDataFolderPath;

  if (!releaseChannel.isDev()) {
    process.env.CONFIG_PATH = path.join(__dirname, '..', '..', '..', '..', '..', 'config');
  }

  const configForGetPort = {
    port: getPortListByVersion(releaseChannel.getVersion()),
    host: '0.0.0.0',
  };
  console.log('Trying to start internal ProcessEngine on ports:', configForGetPort);

  const port = await getPort(configForGetPort);

  console.log(`Internal ProcessEngine starting on port ${port}.`);

  process.env.http__http_extension__server__port = `${port}`;

  const processEngineDatabaseFolderName = getProcessEngineDatabaseFolderName();

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
  ipcMain.on('add_internal_processengine_status_listener', (event: IpcMainEvent) => {
    if (!processEngineStatusListeners.includes(event.sender)) {
      processEngineStatusListeners.push(event.sender);
    }

    if (internalProcessEngineStatus !== undefined) {
      sendInternalProcessEngineStatus(event.sender, internalProcessEngineStatus, internalProcessEngineStartupError);
    }
  });

  // This tells the frontend the location at which the electron-skeleton
  // will be running; this 'get_host' request ist emitted in src/main.ts.
  ipcMain.on('get_host', (event: IpcMainEvent) => {
    event.returnValue = `localhost:${port}`;
  });

  ipcMain.on('get_version', (event: IpcMainEvent) => {
    event.returnValue = ProcessEngineVersion;
  });

  try {
    await startRuntime();

    runtimeProcess.on('close', (code) => {
      const error = new Error(`Runtime exited with code ${code}`);
      console.error(error);
    });

    runtimeProcess.on('error', (err) => {
      const error = new Error(err.toString());
      console.error('Internal ProcessEngine Error: ', error);
    });

    console.log('Internal ProcessEngine started successfully.');
    internalProcessEngineStatus = 'success';

    publishProcessEngineStatus(
      processEngineStatusListeners,
      internalProcessEngineStatus,
      internalProcessEngineStartupError,
    );
  } catch (error) {
    console.error('Failed to start internal ProcessEngine: ', error);
    internalProcessEngineStatus = 'error';
    // eslint-disable-next-line no-multi-assign
    internalProcessEngineStartupError = peErrors += error;

    publishProcessEngineStatus(
      processEngineStatusListeners,
      internalProcessEngineStatus,
      internalProcessEngineStartupError,
    );
  }
}

async function startRuntime(): Promise<void> {
  return new Promise((resolve: Function, reject: Function): void => {
    const sqlitePath = getProcessEngineDatabaseFolder();
    const logFilepath = getProcessEngineLogFolder();

    const pathToRuntime = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'node_modules',
      '@process-engine',
      'process_engine_runtime',
      'bin',
      'index.js',
    );
    runtimeProcess = fork(pathToRuntime, [`--sqlitePath=${sqlitePath}`, `--logFilePath=${logFilepath}`], {
      stdio: 'pipe',
    });

    runtimeProcess.stdout.on('data', (data) => process.stdout.write(data));
    runtimeProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
      peErrors += data.toString();
    });

    runtimeProcess.on('message', (message) => {
      if (message === 'started') {
        resolve();
      }
    });

    runtimeProcess.on('close', (code) => {
      const error = new Error(`Runtime exited with code ${code}`);
      reject(error);
    });

    runtimeProcess.on('error', (err) => {
      reject(err);
    });
  });
}

function getProcessEngineLogFolder(): string {
  return path.join(getConfigFolder(), getProcessEngineLogFolderName());
}

function getProcessEngineLogFolderName(): string {
  return 'process_engine_logs';
}

function getProcessEngineDatabaseFolder(): string {
  return path.join(getConfigFolder(), getProcessEngineDatabaseFolderName());
}

function getProcessEngineDatabaseFolderName(): string {
  return 'process_engine_databases';
}

function sendInternalProcessEngineStatus(
  sender: WebContents,
  internalProcessEngineStatus,
  internalProcessEngineStartupError,
): any {
  let serializedStartupError;
  const processEngineStartHasFailed =
    internalProcessEngineStartupError !== undefined && internalProcessEngineStartupError !== null;

  if (processEngineStartHasFailed) {
    if (typeof internalProcessEngineStartupError === 'string') {
      serializedStartupError = internalProcessEngineStartupError;
    } else {
      serializedStartupError = JSON.stringify(
        internalProcessEngineStartupError,
        Object.getOwnPropertyNames(internalProcessEngineStartupError),
      );
    }
  } else {
    serializedStartupError = undefined;
  }

  sender.send('internal_processengine_status', internalProcessEngineStatus, serializedStartupError);
}

function publishProcessEngineStatus(
  processEngineStatusListeners,
  internalProcessEngineStatus,
  internalProcessEngineStartupError,
): void {
  processEngineStatusListeners.forEach((processEngineStatusLisener) => {
    sendInternalProcessEngineStatus(
      processEngineStatusLisener,
      internalProcessEngineStatus,
      internalProcessEngineStartupError,
    );
  });
}

function getConfigFolder(): string {
  const configPath = `bpmn-studio${getConfigPathSuffix()}`;

  return path.join(getUserConfigFolder(), configPath);
}

function getConfigPathSuffix(): string {
  if (process.env.SPECTRON_TESTS) {
    return '-tests';
  }
  if (releaseChannel.isDev()) {
    return '-dev';
  }
  if (releaseChannel.isAlpha()) {
    return '-alpha';
  }
  if (releaseChannel.isBeta()) {
    return '-beta';
  }
  if (releaseChannel.isStable()) {
    return '';
  }

  throw new Error('Could not get config path suffix for internal process engine');
}

function getBranchOfCurrentVersion(): string {
  if (releaseChannel.isDev()) {
    return 'develop';
  }
  if (releaseChannel.isAlpha()) {
    return 'develop';
  }
  if (releaseChannel.isBeta()) {
    return 'beta';
  }
  if (releaseChannel.isStable()) {
    return 'master';
  }

  throw new Error('Could not get the branch of the current version.');
}

function getUserConfigFolder(): string {
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

function bringExistingInstanceToForeground(): void {
  if (browserWindow) {
    if (browserWindow.isMinimized()) {
      browserWindow.restore();
    }

    browserWindow.focus();
  }
}

async function exportDatabases(): Promise<void> {
  const zip = new JSZip();

  addFolderToZip(zip, getProcessEngineDatabaseFolderName(), getProcessEngineDatabaseFolder());

  // eslint-disable-next-line newline-per-chained-call
  const now = new Date().toISOString().replace(/:/g, '-');
  const defaultFilename = `database-backup-${now}.zip`;

  const pathToSaveTo: string = await getPathToSaveTo(defaultFilename);

  if (!pathToSaveTo) {
    return;
  }

  zip.generateAsync({type: 'nodebuffer'}).then((content) => {
    fs.writeFileSync(pathToSaveTo, content);
  });
}

async function createFeedbackZip(feedbackData: FeedbackData): Promise<void> {
  const zip = new JSZip();

  const feedbackFolder = zip.folder('feedback');

  if (feedbackData.attachInternalDatabases) {
    const processEngineFolder = feedbackFolder.folder('InternalProcessEngine');

    addFolderToZip(processEngineFolder, getProcessEngineDatabaseFolderName(), getProcessEngineDatabaseFolder());
  }

  if (feedbackData.attachProcessEngineLogs) {
    const processEngineFolder = feedbackFolder.folder('InternalProcessEngine');

    addFolderToZip(processEngineFolder, getProcessEngineLogFolderName(), getProcessEngineLogFolder());
  }

  const bugsProvided: boolean = feedbackData.bugs.trim() !== '';
  if (bugsProvided) {
    feedbackFolder.file('Bugs.txt', feedbackData.bugs);
  }

  const suggestionsProvided: boolean = feedbackData.suggestions.trim() !== '';
  if (suggestionsProvided) {
    feedbackFolder.file('Suggestions.txt', feedbackData.suggestions);
  }

  const diagramsProvided: boolean = feedbackData.diagrams.length > 0;
  if (diagramsProvided) {
    const diagramFolder = feedbackFolder.folder('diagrams');

    feedbackData.diagrams.forEach((diagram) => {
      let diagramSolution: string = '';

      if (solutionIsRemoteSolution(diagram.uri)) {
        const diagramUriWithoutProtocol = diagram.uri.substring(diagram.uri.indexOf('/') + 2);
        const diagramUriWithoutProtocolAndLocation = diagramUriWithoutProtocol.substring(
          0,
          diagramUriWithoutProtocol.indexOf('/'),
        );
        const diagramUriWithoutProtocolAndLocationWithEscapedPort = diagramUriWithoutProtocolAndLocation.replace(
          ':',
          '__',
        );

        diagramSolution = diagramUriWithoutProtocolAndLocationWithEscapedPort;
      } else {
        const escapedDiagramUri = diagram.uri.substring(0, diagram.uri.lastIndexOf('/')).replace(/[/\\]/g, '__');

        diagramSolution = escapedDiagramUri.startsWith('__') ? escapedDiagramUri.replace('__', '') : escapedDiagramUri;
      }

      const solutionFolder = diagramFolder.folder(diagramSolution);
      const diagramName: string = `${diagram.name}${
        diagram.name.endsWith('.bpmn') || diagram.name.endsWith('.xml') ? '' : '.bpmn'
      }`;

      solutionFolder.file(diagramName, diagram.xml);
    });

    const additionalDiagramInformationProvided: boolean = feedbackData.additionalDiagramInformation.trim() !== '';
    if (additionalDiagramInformationProvided) {
      diagramFolder.file('Additional Diagram Information.txt', feedbackData.additionalDiagramInformation);
    }
  }

  // eslint-disable-next-line newline-per-chained-call
  const now = new Date().toISOString().replace(/:/g, '-');
  const defaultFilename = `feedback-${now}.zip`;

  const pathToSaveTo: string = await getPathToSaveTo(defaultFilename);

  if (!pathToSaveTo) {
    return;
  }

  zip.generateAsync({type: 'nodebuffer'}).then((content) => {
    fs.writeFileSync(pathToSaveTo, content);
  });
}

function getNamesOfFilesAndFoldersInFolder(foldername): Array<fs.Dirent> {
  return fs.readdirSync(foldername, {withFileTypes: true});
}

async function getPathToSaveTo(defaultFilename): Promise<string> {
  const downloadPath = electron.app.getPath('downloads');
  const defaultPath = path.join(downloadPath, defaultFilename);

  const saveDialogResult = await dialog.showSaveDialog({
    defaultPath: defaultPath,
    filters: [
      {
        name: 'zip',
        extensions: ['zip'],
      },
      {
        name: 'All Files',
        extensions: ['*'],
      },
    ],
  });

  if (saveDialogResult.canceled) {
    return undefined;
  }

  return saveDialogResult.filePath;
}

function addFolderToZip(zipFolder, folderName, folderPath): void {
  if (!fs.existsSync(folderPath)) {
    zipFolder.file(`${folderName} does not exist.`, '', {base64: true});

    return;
  }

  const folderInZip = zipFolder.folder(folderName);

  const filesAndFoldersInFolder: Array<fs.Dirent> = getNamesOfFilesAndFoldersInFolder(folderPath);

  filesAndFoldersInFolder.forEach((fileOrFolder: fs.Dirent) => {
    const currentElementsPath: string = `${folderPath}/${fileOrFolder.name}`;

    if (fileOrFolder.isDirectory()) {
      addFolderToZip(folderInZip, fileOrFolder.name, currentElementsPath);
    } else {
      addFileToZip(folderInZip, fileOrFolder.name, currentElementsPath);
    }
  });
}

function addFileToZip(zipFolder, filename, filePath): void {
  zipFolder.file(filename, fs.readFileSync(filePath), {base64: true});
}

execute();
