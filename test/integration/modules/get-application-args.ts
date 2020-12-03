import path from 'path';
import {AppConstructorOptions} from 'spectron';

const isWindows = process.platform === 'win32';

function getApplicationArgs(givenPath: string | null): AppConstructorOptions {
  const webdriverLogPath = path.join(__dirname, '..', '..', '..', '..', '..', 'test-results', 'logs', 'web-driver');
  const commonArgs = {
    requireName: 'nodeRequire',
    env: {
      SPECTRON_TESTS: true,
    },
    webdriverOptions: {
      deprecationWarnings: false,
    },
    webdriverLogPath: webdriverLogPath,
  };

  if (givenPath != null) {
    console.log(`Using path: ${givenPath}`);
    return {...commonArgs, path: givenPath};
  }

  const electronExecutable = isWindows ? 'electron.cmd' : 'electron';
  const electronPath = path.join(__dirname, '..', '..', '..', '..', '..', 'node_modules', '.bin', electronExecutable);
  const electronBundlePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'dist',
    'electron_app',
    'electron_app',
    'electron.js',
  );

  return {...commonArgs, path: electronPath, args: [electronBundlePath]};
}

export const applicationArgs = getApplicationArgs(process.env.SPECTRON_APP_PATH);
