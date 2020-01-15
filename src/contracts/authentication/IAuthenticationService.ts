import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoginResult} from './ILoginResult';
import {IUserIdentity} from './IUserIdentity';

export interface IAuthenticationService {
  login(authority: string, refreshCallback: Function): Promise<ILoginResult>;
  logout(authority: string, identity: IIdentity): Promise<void>;
  isLoggedIn(authority: string, identity: IIdentity): Promise<boolean>;
  getUserIdentity(authrotiy: string, identity: IIdentity): Promise<IUserIdentity>;
}
