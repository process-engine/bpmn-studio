export function isRunningInElectron(): boolean {
  return Boolean((window as any).nodeRequire);
}

export async function isRunningAsDevelop(): Promise<boolean> {
  if (!isRunningInElectron) {
    return false;
  }

  return new Promise((resolve) => {
    const ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;

    ipcRenderer.once('isDevelop', (event, isDevelop) => {
      resolve(isDevelop);
    });

    ipcRenderer.send('isDevelop');
  });
}
