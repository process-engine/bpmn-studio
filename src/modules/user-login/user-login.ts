import {bindable, computedFrom, inject} from 'aurelia-framework';
import {IAuthenticationService, IIdentity} from '../../contracts/index';

@inject('AuthenticationService')
export class UserLogin {

  private authenticationService: IAuthenticationService;
  private dropdown: HTMLLIElement;
  private windowClickListener: (event: MouseEvent) => void;
  @bindable()
  private username: string;
  @bindable()
  private password: string;
  @bindable()
  private loginError: string;

  public dropdownIsOpen: boolean = false;

  constructor(authenticationService: IAuthenticationService) {
    this.authenticationService = authenticationService;
  }

  public toggleDropdown(): void {
    this.dropdownIsOpen = !this.dropdownIsOpen;
  }

  public get hasValidInput(): boolean {
    const validUsername: boolean = this.username !== null && this.username !== undefined && this.username !== '';
    const validPassword: boolean = this.password !== null && this.password !== undefined && this.password !== '';
    return validUsername && validPassword;
  }

  public async login(): Promise<void> {
    try {
      await this.authenticationService.login(this.username, this.password);
      this.username = null;
      this.password = null;
      this.loginError = null;
      this.toggleDropdown();
    } catch (error) {
      this.loginError = error.message;
    }
  }

  public logout(): void {
    this.authenticationService.logout();
    this.toggleDropdown();
  }

  @computedFrom('authenticationService.tokenRepository.token')
  public get isLoggedIn(): boolean {
    return this.authenticationService.hasToken();
  }

  @computedFrom('isLoggedIn')
  public get identity(): IIdentity {
    return this.authenticationService.getIdentity();
  }
}
