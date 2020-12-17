const {notarize} = require('electron-notarize');
const {getReleaseChannelSuffix} = require('../../../electron-builder/release');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.APPLE_USERNAME || !process.env.APPLE_PASSWORD) {
    console.warn(
      '[notarize]\tSkipping notarization: Environment variable "APPLE_USERNAME" and/or "APPLE_PASSWORD" not set.',
    );
    return;
  }

  const appOutDir = context.appOutDir;
  const appName = context.packager.appInfo.productFilename;
  const appBundleId = `com.electron.bpmn-studio${getReleaseChannelSuffix()}`;

  console.log(`[notarize]\tNotarizing ${appName}`);

  await notarize({
    appBundleId: appBundleId,
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_USERNAME,
    appleIdPassword: process.env.APPLE_PASSWORD,
  });
};
