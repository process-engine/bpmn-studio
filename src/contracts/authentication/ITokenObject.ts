export interface ITokenObject {
  idToken: string;
  accessToken: string;
  userId?: string;
  expiresIn: number;
}
