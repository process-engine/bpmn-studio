import {inject} from 'aurelia-framework';

import {NotificationService} from '../../services/notification-service/notification.service';
import {NotificationType} from '../../contracts/index';
import {UserConfigService} from '../../services/user-config-service/user-config.service';

@inject('NotificationService', 'UserConfigService')
export class Preferences {
  public preferences: string;
  private notificationService: NotificationService;
  private userConfigService: UserConfigService;

  constructor(notificationService: NotificationService, userConfigService: UserConfigService) {
    this.notificationService = notificationService;
    this.userConfigService = userConfigService;
  }

  public attached(): void {
    const loadedPreferences = this.userConfigService.getCurrentConfig();

    this.preferences = JSON.stringify(loadedPreferences, null, 2);
  }

  public save(): void {
    if (this.isValidJSON()) {
      const customConfig: object = {};
      const defaultConfig: object = this.userConfigService.getDefaultConfig();

      Object.entries(JSON.parse(this.preferences)).forEach((entry: [string, string]) => {
        const defaultConfigEntry = defaultConfig[entry[0]];
        if (defaultConfigEntry !== entry[1]) {
          customConfig[entry[0]] = entry[1];
        }
      });

      this.userConfigService.persistUserConfig(customConfig);
    } else {
      this.notificationService.showNotification(
        NotificationType.ERROR,
        'Error:\n The preferences can not be saved! \nNot a valid JSON format!',
      );
    }
  }

  private isValidJSON(): boolean {
    try {
      JSON.parse(this.preferences);
      return true;
    } catch (error) {
      return false;
    }
  }
}
