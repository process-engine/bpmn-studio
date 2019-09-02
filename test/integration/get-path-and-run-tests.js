/* eslint-disable @typescript-eslint/no-require-imports */
const exec = require('child_process').exec;

function getNpmTestScriptName() {
  const isWindows = process.platform === 'win32';
  const platform = isWindows ? 'windows' : 'macos';

  return `npm run test-electron-${platform}`;
}

async function getBuiltStudioPath() {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const result = await execCommand('find ./dist/electron/win-unpacked/**.exe');
    return `"${result.substr(2).trim()}"`;
  }

  const result = await execCommand('find ./dist/electron/mac/**.app/Contents/MacOS/BPMN**');
  return result
    .substr(2)
    .replace(/\s/g, '\\ ')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
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
  const pathToStudio = await getBuiltStudioPath();

  exec(`cross-env SPECTRON_APP_PATH=${pathToStudio} ${getNpmTestScriptName()}`, (err, stdout, stderr) => {
    if (err || stderr) {
      console.error(err, stderr);
    }

    console.log(stdout);
  });
}

runTests();
