/* eslint-disable @typescript-eslint/no-require-imports */
const exec = require('child_process').exec;

function getTestCommand() {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    return 'windows';
  }

  return 'macos';
}

async function getBuildedStudioPath() {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const result = await execCommand('find ./dist/electron/win-unpacked/**.exe');
    return `"${result.substr(2).trim()}"`;
  }

  const result = await execCommand('find ./dist/electron/mac/**.app/Contents/MacOS/BPMN**');
  return result
    .substr(2)
    .replace(/[\s]/gm, '\\ ')
    .replace(/[(]/gm, '\\(')
    .replace(/[)]/gm, '\\)')
    .trim()
    .slice(0, -1);
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
  const pathToStudio = await getBuildedStudioPath();

  exec(
    `cross-env SPECTRON_APP_PATH=${pathToStudio} npm run test-electron-${getTestCommand()}`,
    (err, stdout, stderr) => {
      if (err || stderr) {
        console.error(err, stderr);
      }

      console.log(stdout);
    },
  );
}

runTests();
