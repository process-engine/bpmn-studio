const fs = require('fs');

const {getReleaseChannelSuffix} = require('./release');

const releaseChannelSuffix = getReleaseChannelSuffix();
const isPortableBuild = process.env.isPortableBuild;

const portableIdentifier = isPortableBuild ? '-portable' : '';

fs.readFile('package.json', 'utf8', (err, data) => {
  if (err) {
    throw err;
  }

  const dataWithNewName = data.replace(
    '  "name": "bpmn-studio",',
    `  "name": "bpmn-studio${releaseChannelSuffix}${portableIdentifier}",`,
  );

  fs.writeFile('package.json', dataWithNewName, (errWrite) => {
    if (errWrite) {
      throw errWrite;
    }

    console.log(`[set-name-in-package-json]\tSet name to bpmn-studio${releaseChannelSuffix}${portableIdentifier}`);
  });
});
