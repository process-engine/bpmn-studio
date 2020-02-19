const fs = require('fs');

const {getReleaseChannelSuffix} = require('./release');

const releaseChannelSuffix = getReleaseChannelSuffix();

const MODE = process.env.MODE;
const portableName = MODE ? `-${MODE}` : '';

fs.readFile('package.json', 'utf8', (err, data) => {
  if (err) {
    throw err;
  }

  const dataWithNewName = data.replace(
    `  "name": "bpmn-studio${releaseChannelSuffix}${portableName}",`,
    '  "name": "bpmn-studio",',
  );

  fs.writeFile('package.json', dataWithNewName, (errWrite) => {
    if (errWrite) {
      throw errWrite;
    }

    console.log('[reset-name-in-package-json]\tReset name to bpmn-studio');
  });
});
