/* eslint-disable @typescript-eslint/no-require-imports */
const exec = require('child_process').exec;

function getBuildedStudioPath() {
  return execCommand('find ./dist/electron/mac/**.app/Contents/MacOS/BPMN**');
}

async function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdin, stderr) => {
      if (err || stderr) {
        reject(err, stderr);
      }
      return resolve(stdin);
    });
  });
}

async function runTests() {
  let pathToStudio = await getBuildedStudioPath();
  pathToStudio = pathToStudio
    .substr(2)
    .replace(/[\s]/gm, '\\ ')
    .replace(/[(]/gm, '\\(')
    .replace(/[)]/gm, '\\)')
    .trim();

  exec(
    `SPECTRON_APP_PATH=${pathToStudio.substr(0, pathToStudio.length - 1)} npm run test-electron-macos`,
    (err, stdout, stderr) => {
      if (err || stderr) {
        console.error(err, stderr);
      }

      console.log(stdout);
    },
  );
}

runTests();
