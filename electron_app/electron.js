const electron = require('electron');
const autoUpdater = require('electron-updater').autoUpdater;
const path = require('path');
const app = electron.app;
const notifier = require('electron-notifications');
const isDev = require('electron-is-dev');
const getPort = require('get-port');
const prereleaseRegex = /\d+\.\d+\.\d+-pre-b\d+/;

if (!isDev) {
  const userDataFolder = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/local');
  process.env.datastore__service__data_sources__default__adapter__databasePath = path.join(userDataFolder, 'process-engine_database');

  process.env.CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'config');
}

getPort({port: 8000, host: '0.0.0.0'})
.then((port) => {
  process.env.http__http_extension__server__port = port;
  const pe = require('@process-engine/skeleton-electron');

  electron.ipcMain.on('get_host', (event) => {
    event.returnValue = `localhost:${port}`;
  });

  let mainWindow = null;

  const installButtonText = 'Install';
  const dismissButtonText = 'Dismiss';

  function createWindow () {
    if (mainWindow !== null) {
      return;
    }

    mainWindow = new electron.BrowserWindow({
      width: 1000,
      height: 800,
      title: "BPMN-Studio",
      minWidth: 1000,
      minHeight: 800,
      icon: path.join(__dirname, '../build/icon.png'),  // only for windows and linux
    });

    mainWindow.loadURL(`file://${__dirname}/../index.html`);
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    autoUpdater.checkForUpdates();

    const currentVersion = electron.app.getVersion();
    const currentVersionIsPrerelease = prereleaseRegex.test(currentVersion);

    autoUpdater.allowPrerelease = currentVersionIsPrerelease;

    console.log(`CurrentVersion: ${currentVersion}, CurrentVersionIsPrerelease: ${currentVersionIsPrerelease}`);

    autoUpdater.addListener('error', (error) => {
      const notification = notifier.notify('Update error', {
        message: 'Update failed',
        buttons: [dismissButtonText],
      });
      notification.on('buttonClicked', (text, buttonIndex, options) => {
        notification.close();
      });
    });

    autoUpdater.addListener('update-available', (info) => {
      notifier.notify('Update available', {
        message: 'Started downloading',
        buttons: [dismissButtonText],
      });
    });

    autoUpdater.addListener('update-downloaded', (info) => {
      const notification = notifier.notify('Update ready', {
        message: 'Update ready for installation',
        duration: '60000',
        buttons: [installButtonText, dismissButtonText],
      });

      notification.on('buttonClicked', (text, buttonIndex, options) => {
        const installButtonClicked = text === installButtonText;
        if (installButtonClicked) {
          autoUpdater.quitAndInstall();
        } else {
          notification.close();
        }
      })
    });

    var template = [{
      label: "BPMN-Studio",
      submenu: [
          {
            label: "About BPMN-Studio", selector: "orderFrontStandardAboutPanel:"
          },
          {
            type: "separator"
          },
          {
            label: "Quit", accelerator: "Command+Q", click: function() {
            app.quit();
          }}
      ]}, {
      label: "Edit",
      submenu: [
          {
            label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:"
          },
          {
            label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:"
          },
          {
            label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:"
          },
          {
            label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:"
          }
      ]}
    ];
    electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
  }

  app.on('ready', createWindow);
  app.on('activate', createWindow);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});
