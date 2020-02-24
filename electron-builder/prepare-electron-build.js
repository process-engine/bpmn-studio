const fs = require('fs');

const {getReleaseChannel} = require('./release');

function copyFile(fromFile, toFile) {
  console.log(`Copying ${fromFile} to ${toFile}`);
  const errorCallback = (err) => {
    if (err) {
      console.error(err);
    }
  };
  fs.copyFile(fromFile, toFile, errorCallback);
}

const releaseChannel = getReleaseChannel();

copyFile(`electron-builder/${releaseChannel}/electron-builder.yml`, 'build/electron-builder.yml');
copyFile(`electron-builder/${releaseChannel}/icon.png`, 'build/icon.png');
copyFile(`electron-builder/${releaseChannel}/icon.icns`, 'build/icon.icns');
