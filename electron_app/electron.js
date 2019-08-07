/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-underscore-dangle */
const electron = require('electron');

const {
  ipcMain,
  dialog,
  app,
} = electron;

const autoUpdater = require('electron-updater').autoUpdater;
const CancellationToken = require('electron-updater').CancellationToken;
const path = require('path');

const getPort = require('get-port');
const fs = require('fs');
const openAboutWindow = require('about-window').default;
const studioVersion = require('../package.json').version;

const electronOidc = require('./electron-oidc');
const oidcConfig = require('./oidc-config');

const {
  ReleaseChannel,
} = require('../src/services/release-channel-service/release-channel-service');
const {
  getDefaultPorts,
} = require('../src/services/default-ports-module/default-ports-module');

const releaseChannel = new ReleaseChannel(studioVersion);

// If BPMN-Studio was opened by double-clicking a .bpmn file, then the
// following code tells the frontend the name and content of that file;
// this 'get_opened_file' request is emmitted in src/main.ts.
let filePath;
let isInitialized = false;

const Main = {};

/**
 * This variable gets set when BPMN-Studio is ready to work with Files that are
 * openend via double click.
 */
let fileOpenMainEvent;

Main._window = null;

Main.execute = () => {
  /**
   * Makes this application a Single Instance Application.
   */
  app.requestSingleInstanceLock();

  /**
   * Check if this application got the Single Instance Lock.
   * true: This instance is the first instance.
   * false: This instance is the second instance.
   */
  const hasSingleInstanceLock = app.hasSingleInstanceLock();

  if (hasSingleInstanceLock) {
    Main._initializeApplication();

    Main._startInternalProcessEngine();

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
        Main._bringExistingInstanceToForeground();

        answerOpenFileEvent(filePath);
      }

      const argumentContainsRedirect = argumentIsSignInRedirect || argumentIsSignOutRedirect;
      if (argumentContainsRedirect) {
        const redirectUrl = argv[1];

        Main._window.loadURL(`file://${__dirname}/../index.html`);
        Main._window.loadURL('/');

        electron.ipcMain.once('deep-linking-ready', (event) => {
          Main._window.webContents.send('deep-linking-request', redirectUrl);
        });
      }
    });
  } else {
    app.quit();
  }
};

Main._initializeApplication = () => {
  app.on('ready', () => {
    Main._createMainWindow();
  });

  app.on('activate', () => {
    if (Main._window === null) {
      Main._createMainWindow();
    }
  });

  if (!releaseChannel.isDev()) {
    initializeAutoUpdater();
  }

  initializeFileOpenFeature();
  initializeOidc();

  function initializeAutoUpdater() {
    electron.ipcMain.on('app_ready', async (appReadyEvent) => {
      autoUpdater.autoDownload = false;

      const currentVersion = electron.app.getVersion();
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

        Main._window.setProgressBar(progressInPercent);

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
  function initializeOidc() {
    const windowParams = {
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
      },
    };

    const electronOidcInstance = electronOidc(oidcConfig, windowParams);

    ipcMain.on('oidc-login', (event, authorityUrl) => {
      electronOidcInstance.getTokenObject(authorityUrl).then(
        (token) => {
          event.sender.send('oidc-login-reply', token);
        },
        (err) => {
          console.log('Error while getting token', err);
        },
      );
    });

    ipcMain.on('oidc-logout', (event, tokenObject, authorityUrl) => {
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

  function initializeFileOpenFeature() {
    app.on('window-all-closed', () => {
      app.quit();
      filePath = undefined;
    });

    app.on('will-finish-launching', () => {
      // for windows
      if (process.platform === 'win32' && process.argv.length >= 2) {
        filePath = process.argv[1];
      }

      // for non-windows
      app.on('open-file', (event, path) => {
        filePath = isInitialized ? undefined : path;

        if (isInitialized) {
          answerOpenFileEvent(path);
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
    electron.ipcMain.on('waiting-for-double-file-click', (mainEvent) => {
      this.fileOpenMainEvent = mainEvent;
      isInitialized = true;
    });

    electron.ipcMain.on('get_opened_file', (event) => {
      if (filePath === undefined) {
        event.returnValue = {};
        return;
      }

      event.returnValue = {
        path: filePath,
        content: fs.readFileSync(filePath, 'utf8'),
      };
      filePath = undefined;
      app.focus();
    });
  }
};

function answerOpenFileEvent(filePath) {
  this.fileOpenMainEvent.sender.send('double-click-on-file', filePath);
}

Main._createMainWindow = () => {
  console.log('create window called');

  setElectronMenubar();

  Main._window = new electron.BrowserWindow({
    width: 1300,
    height: 800,
    title: 'BPMN-Studio',
    minWidth: 1300,
    minHeight: 800,
    icon: path.join(__dirname, '../build/icon.png'), // only for windows
    titleBarStyle: 'hiddenInset',
  });

  Main._window.loadURL(`file://${__dirname}/../index.html`);
  // We need to navigate to "/" because something in the push state seems to be
  // broken if we carry a file system link as the last item of the browser
  // history.
  Main._window.loadURL('/');

  electron.ipcMain.on('close_bpmn-studio', (event) => {
    Main._window.close();
  });

  Main._window.on('closed', (event) => {
    Main._window = null;
  });

  setOpenDiagram();
  setSaveDiagramAs();
  setOpenSolutions();

  const platformIsWindows = process.platform === 'win32';
  if (platformIsWindows) {
    Main._window.webContents.session.on('will-download', (event, downloadItem) => {
      const defaultFilename = downloadItem.getFilename();

      const fileTypeIndex = defaultFilename.lastIndexOf('.') + 1;
      const fileExtension = defaultFilename.substring(fileTypeIndex);

      const fileExtensionIsBPMN = fileExtension === 'bpmn';
      const fileType = fileExtensionIsBPMN ? 'BPMN (.bpmn)' : `Image (.${fileExtension})`;

      const filename = dialog.showSaveDialog({
        defaultPath: defaultFilename,
        filters: [{
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

  function setSaveDiagramAs() {
    electron.ipcMain.on('open_save-diagram-as_dialog', (event) => {
      const filePath = dialog.showSaveDialog({
        filters: [{
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

  function setOpenDiagram() {
    electron.ipcMain.on('open_diagram', (event) => {
      const openedFile = dialog.showOpenDialog({
        filters: [{
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

  function setOpenSolutions() {
    electron.ipcMain.on('open_solution', (event) => {
      const openedFile = dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });

      event.sender.send('import_opened_solution', openedFile);
    });
  }

  function setElectronMenubar() {
    const copyrightYear = new Date().getFullYear();

    const getApplicationMenu = () => {
      return {
        label: 'BPMN-Studio',
        submenu: [{
            label: 'About BPMN-Studio',
            click: () =>
              openAboutWindow({
                icon_path: releaseChannel.isDev() ?
                  path.join(__dirname, '..', 'build/icon.png') : path.join(__dirname, '../../../build/icon.png'),
                product_name: 'BPMN-Studio',
                bug_report_url: 'https://github.com/process-engine/bpmn-studio/issues/new',
                homepage: 'www.process-engine.io',
                copyright: `Copyright © ${copyrightYear} process-engine`,
                win_options: {
                  minimizable: false,
                  maximizable: false,
                  resizable: false,
                },
                package_json_dir: __dirname,
              }),
          },
          {
            type: 'separator',
          },
          {
            label: 'Quit',
            role: 'quit',
          },
        ],
      };
    };

    const getFileMenu = () => {
      return {
        label: 'File',
        submenu: [{
            label: 'New Diagram',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              Main._window.webContents.send('menubar__start_create_diagram');
            },
          },
          {
            type: 'separator',
          },
          {
            label: 'Open Diagram',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              Main._window.webContents.send('menubar__start_opening_diagram');
            },
          },
          {
            label: 'Open Solution',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: () => {
              Main._window.webContents.send('menubar__start_opening_solution');
            },
          },
          {
            type: 'separator',
          },
          {
            label: 'Save Diagram',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              Main._window.webContents.send('menubar__start_save_diagram');
            },
          },
          {
            label: 'Save Diagram As...',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => {
              Main._window.webContents.send('menubar__start_save_diagram_as');
            },
          },
          {
            label: 'Save All Diagrams',
            accelerator: 'CmdOrCtrl+Alt+S',
            click: () => {
              Main._window.webContents.send('menubar__start_save_all_diagrams');
            },
          },
          {
            type: 'separator',
          },
          {
            label: 'Close Diagram',
            accelerator: 'CmdOrCtrl+W',
            click: () => {
              Main._window.webContents.send('menubar__start_close_diagram');
            },
          },
          {
            label: 'Close All Diagrams',
            accelerator: 'CmdOrCtrl+Alt+W',
            click: () => {
              Main._window.webContents.send('menubar__start_close_all_diagrams');
            },
          },
        ],
      };
    };

    const getEditMenu = () => {
      return {
        label: 'Edit',
        submenu: [{
            label: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            selector: 'undo:',
          },
          {
            label: 'Redo',
            accelerator: 'CmdOrCtrl+Shift+Z',
            selector: 'redo:',
          },
          {
            type: 'separator',
          },
          {
            label: 'Cut',
            accelerator: 'CmdOrCtrl+X',
            selector: 'cut:',
          },
          {
            label: 'Copy',
            accelerator: 'CmdOrCtrl+C',
            selector: 'copy:',
          },
          {
            label: 'Paste',
            accelerator: 'CmdOrCtrl+V',
            selector: 'paste:',
          },
          {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            selector: 'selectAll:',
          },
        ],
      };
    };

    const getWindowMenu = () => {
      const windowMenu = {
        label: 'Window',
        submenu: [],
      };

      windowMenu.submenu.push({
        role: 'minimize',
      });
      windowMenu.submenu.push({
        role: 'close',
      });
      windowMenu.submenu.push({
        type: 'separator',
      });

      windowMenu.submenu.push({
        role: 'reload',
      });

      windowMenu.submenu.push({
        role: 'toggledevtools',
      });

      return windowMenu;
    };

    const getHelpMenu = () => {
      return {
        label: 'Help',
        submenu: [{
            label: 'Documentation',
            click: () => {
              const documentationUrl = 'https://www.process-engine.io/documentation/';
              electron.shell.openExternal(documentationUrl);
            },
          },
          {
            label: 'Release Notes for Current Version',
            click: () => {
              const currentVersion = electron.app.getVersion();
              const currentReleaseNotesUrl = `https://github.com/process-engine/bpmn-studio/releases/tag/v${currentVersion}`;
              electron.shell.openExternal(currentReleaseNotesUrl);
            },
          },
        ],
      };
    };

    const showMenuEntriesWithoutDiagramEntries = () => {
      let previousEntryIsSeparator = false;

      const fileMenu = getFileMenu();
      const filteredFileSubmenu = fileMenu.submenu.filter((submenuEntry) => {
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
      fileMenu.submenu = filteredFileSubmenu;

      const template = [getApplicationMenu(), fileMenu, getEditMenu(), getWindowMenu(), getHelpMenu()];

      electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
    };

    const showAllMenuEntries = () => {
      const template = [getApplicationMenu(), getFileMenu(), getEditMenu(), getWindowMenu(), getHelpMenu()];

      electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
    };

    showMenuEntriesWithoutDiagramEntries();

    electron.ipcMain.on('menu_hide-diagram-entries', () => {
      showMenuEntriesWithoutDiagramEntries();
    });

    electron.ipcMain.on('menu_show-all-menu-entries', () => {
      showAllMenuEntries();
    });
  }
};

Main._startInternalProcessEngine = async () => {
  const devUserDataFolderPath = path.join(__dirname, '..', 'userData');
  const prodUserDataFolderPath = app.getPath('userData');

  const userDataFolderPath = releaseChannel.isDev() ? devUserDataFolderPath : prodUserDataFolderPath;

  if (!releaseChannel.isDev()) {
    process.env.CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'config');
  }

  const configForGetPort = {
    port: getDefaultPorts(),
    host: '0.0.0.0',
  };
  console.log('Trying to start internal ProcessEngine on ports:', configForGetPort);

  return getPort(configForGetPort).then(async (port) => {
    console.log(`Internal ProcessEngine starting on port ${port}.`);

    process.env.http__http_extension__server__port = port;

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

    let internalProcessEngineStatus;
    let internalProcessEngineStartupError;
    const processEngineStatusListeners = [];

    function _sendInternalProcessEngineStatus(sender) {
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

    function _publishProcessEngineStatus() {
      processEngineStatusListeners.forEach(_sendInternalProcessEngineStatus);
    }

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
    electron.ipcMain.on('add_internal_processengine_status_listener', (event) => {
      if (!processEngineStatusListeners.includes(event.sender)) {
        processEngineStatusListeners.push(event.sender);
      }

      if (internalProcessEngineStatus !== undefined) {
        _sendInternalProcessEngineStatus(event.sender);
      }
    });

    // This tells the frontend the location at which the electron-skeleton
    // will be running; this 'get_host' request ist emitted in src/main.ts.
    electron.ipcMain.on('get_host', (event) => {
      event.returnValue = `localhost:${port}`;
    });

    // TODO: Check if the ProcessEngine instance is now run on the UI thread.
    // See issue https://github.com/process-engine/bpmn-studio/issues/312
    try {
      const sqlitePath = path.join(getConfigFolder(), processEngineDatabaseFolderName);

      // eslint-disable-next-line global-require
      const pe = require('@process-engine/process_engine_runtime');
      pe.startRuntime(sqlitePath);

      console.log('Internal ProcessEngine started successfully.');
      internalProcessEngineStatus = 'success';

      _publishProcessEngineStatus();
    } catch (error) {
      console.error('Failed to start internal ProcessEngine: ', error);
      internalProcessEngineStatus = 'error';
      internalProcessEngineStartupError = error;

      _publishProcessEngineStatus();
    }
  });
};

function getUserConfigFolder() {
  // eslint-disable-next-line global-require
  const userHomeDir = require('os').homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(userHomeDir, 'Library', 'Application Support');
    case 'win32':
      return path.join(userHomeDir, 'AppData', 'Roaming');
    default:
      return path.join(userHomeDir, '.config');
  }
}

function getConfigPathSuffix() {
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

function getConfigFolder() {
  const configPath = `bpmn-studio${getConfigPathSuffix()}`;
  return path.join(getUserConfigFolder(), configPath);
}

Main._bringExistingInstanceToForeground = () => {
  if (Main._window) {
    if (Main._window.isMinimized()) {
      Main._window.restore();
    }

    Main._window.focus();
  }
};

// Run our main class
Main.execute();
