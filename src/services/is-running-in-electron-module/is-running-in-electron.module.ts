export function isRunningInElectron(): boolean {
  return Boolean((window as any).nodeRequire);
}
