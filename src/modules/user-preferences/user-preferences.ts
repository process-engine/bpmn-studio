import {inject} from 'aurelia-framework';

import {NotificationService} from '../../services/notification-service/notification.service';
import {NotificationType} from '../../contracts/index';

@inject('NotificationService')
export class Preferences {
  public preferences: string;
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  public attached(): void {
    const loadedPreferences = JSON.parse(window.localStorage.getItem('customUserConfig'));
    this.preferences = JSON.stringify(loadedPreferences, null, 2);
  }

  public save(): void {
    if (this.validJSON()) {
      window.localStorage.setItem('customUserConfig', this.preferences);
    }
  }

  private validJSON(): boolean {
    try {
      JSON.parse(this.preferences);
      return true;
    } catch (error) {
      this.notificationService.showNotification(
        NotificationType.ERROR,
        'Error:\n The preferences can not be saved! No valid JSON',
      );
      return false;
    }
  }
}
