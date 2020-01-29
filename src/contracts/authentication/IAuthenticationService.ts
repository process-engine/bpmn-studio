import {IIdentity} from '@essential-projects/iam_contracts';

import {ILoginResult} from './ILoginResult';
import {IUserIdentity} from './IUserIdentity';

export interface IAuthenticationService {
  login(authorityUrl: string, solutionUri: string, refreshCallback: Function): Promise<ILoginResult>;
  logout(authorityUrl: string, solutionUri: string, identity: IIdentity): Promise<void>;
  isLoggedIn(authorityUrl: string, identity: IIdentity): Promise<boolean>;
  getUserIdentity(authorityUrl: string, identity: IIdentity): Promise<IUserIdentity>;
}
