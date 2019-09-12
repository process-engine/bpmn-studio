import {ExecException, exec} from 'child_process';

function getNpmTestScriptName(): string {
  const isWindows = process.platform === 'win32';
  const platform = isWindows ? 'windows' : 'macos';

  return `test-electron-${platform}`;
}

async function getBuiltStudioPath(): Promise<string> {
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

async function execCommand(command): Promise<string> {
  return new Promise((resolve: Function, reject: Function): void => {
    exec(command, (err: ExecException, stdin: string, stderr: string) => {
      if (err || stderr) {
        reject(err, stderr);
      }
      return resolve(stdin);
    });
  });
}

async function runTests(): Promise<void> {
  const pathToStudio = await getBuiltStudioPath();

  const childProcess = exec(`cross-env SPECTRON_APP_PATH=${pathToStudio} npm run ${getNpmTestScriptName()}`);

  childProcess.stdout.on('data', (data) => {
    console.log(data);
  });

  childProcess.stderr.on('data', (data) => {
    console.error(data);
    process.exit(1);
  });
}

runTests();
