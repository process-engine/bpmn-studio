import {ExecException, exec} from 'child_process';

function getNpmTestScriptName(): string {
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';
  const isMacOS = process.platform === 'darwin';

  if (isWindows) {
    return 'test-electron-windows';
  }
  if (isLinux) {
    return 'test-electron-linux';
  }
  if (isMacOS) {
    return 'test-electron-macos';
  }

  throw new Error(`Could not determine npm test script name based on platform: ${process.platform}`);
}

function getRawAndEscapedPathForMacOS(result: string): string {
  return result
    .trim()
    .replace(/^\.\//g, '')
    .replace(/\s/g, '\\ ')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

async function getBuiltStudioPath(): Promise<string> {
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  if (isWindows) {
    try {
      const currentDir = await execCommand('CD');
      const result = await execCommand(`where /r ${currentDir.trim()} BPMN?Studio*.exe`);
      const files = result.split('\n');
      const correctPath = files.find((path) => {
        return path.includes('win-unpacked');
      });

      return `"${correctPath.trim()}"`;
    } catch (error) {
      console.error(error);
      return process.exit(1);
    }
  } else if (isLinux) {
    return '';
  }

  try {
    const result = await execCommand('find ./dist/electron/mac/**.app/Contents/MacOS/BPMN**');
    const rawPath = getRawAndEscapedPathForMacOS(result);

    return rawPath;
  } catch (error) {
    console.error(error);
    return process.exit(1);
  }
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
