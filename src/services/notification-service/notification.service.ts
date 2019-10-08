import {inject} from 'aurelia-dependency-injection';
import {EventAggregator} from 'aurelia-event-aggregator';
import toastr from 'toastr';
import {INotification, NotificationType} from '../../contracts/index';

@inject(EventAggregator)
export class NotificationService {
  private eventAggregator: EventAggregator;
  private toastrInstance: Toastr;
  private savedNotifications: Array<INotification> = [];

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;
    this.eventAggregator.subscribeOnce('router:navigation:complete', () => {
      this.setToastrInstance(toastr);
    });
  }

  /**
   * Shows a automatically-disappearing notification message to the user;
   * the notification will disappear after a certain amount of time (@see toastr documenation).
   *
   * @argument type The severity of the notification (@see NotificationType for possible severity level).
   * @argument message The message to display as String.
   */
  public showNotification(type: NotificationType, message: string, options?: ToastrOptions): void {
    const notification: INotification = {
      type: type,
      message: message,
      nonDisappearing: false,
      options: options,
    };
    this.queueOrDisplay(notification);
  }

  /**
   * Shows a non-disappearing notification message to the user, with a close button;
   * the notification will disappear when the user hit the close button.
   *
   * @argument type The severity of the notification (@see NotificationType for possible severity level).
   * @argument message The message to display as String.
   */
  public showNonDisappearingNotification(type: NotificationType, message: string, options?: ToastrOptions): void {
    const notification: INotification = {
      type: type,
      message: message,
      nonDisappearing: true,
      options: options,
    };
    this.queueOrDisplay(notification);
  }

  private queueOrDisplay(notification: INotification): void {
    if (this.toastrInstance === undefined) {
      this.savedNotifications.push(notification);
      return;
    }

    this.publishNotificationToToastr(notification);
  }

  private setToastrInstance(toastrInstance: Toastr): void {
    this.toastrInstance = toastrInstance;

    this.toastrInstance.options = {
      positionClass: 'toast-bottom-left',
      closeDuration: 100,
    };

    this.initializeToastr();
    for (const notification of this.savedNotifications) {
      this.publishNotificationToToastr(notification);
    }
    this.savedNotifications = [];
  }

  private publishNotificationToToastr(notification: INotification): void {
    const toastrOptions: ToastrOptions = this.mapOptionsToToastrOptions(notification);

    switch (notification.type) {
      case NotificationType.SUCCESS:
        this.toastrInstance.success(notification.message, undefined, toastrOptions);
        break;
      case NotificationType.ERROR:
        this.toastrInstance.error(notification.message, undefined, toastrOptions);
        break;
      case NotificationType.INFO:
        this.toastrInstance.info(notification.message, undefined, toastrOptions);
        break;
      case NotificationType.WARNING:
        this.toastrInstance.warning(notification.message, undefined, toastrOptions);
        break;
      default:
        break;
    }
  }

  private initializeToastr(): void {
    this.toastrInstance.options.preventDuplicates = true;
  }

  private mapOptionsToToastrOptions(notification: INotification): ToastrOptions {
    if (notification.nonDisappearing) {
      return {
        closeButton: true,
        closeOnHover: false,
        timeOut: -1,
        ...notification.options,
      };
    }
    return notification.options;
  }
}
