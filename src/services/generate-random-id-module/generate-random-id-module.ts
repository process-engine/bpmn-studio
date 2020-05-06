export function generateRandomId(): string {
  let randomId: string = '';
  const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const randomIdLength: number = 8;
  for (let i: number = 0; i < randomIdLength; i++) {
    randomId += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return randomId;
}
