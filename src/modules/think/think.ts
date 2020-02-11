import {inject} from 'aurelia-framework';
import {activationStrategy} from 'aurelia-router';

import {ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import {NotificationService} from '../../services/notification-service/notification.service';

export interface IThinkRouteParameters {
  view?: string;
  diagramName?: string;
  solutionUri?: string;
}

@inject('SolutionService', 'NotificationService')
export class Think {
  public showDiagramList: boolean = false;

  public activeSolutionEntry: ISolutionEntry;

  private solutionService: ISolutionService;
  private notificationService: NotificationService;

  constructor(solutionService: ISolutionService, notificationService: NotificationService) {
    this.solutionService = solutionService;
    this.notificationService = notificationService;
  }

  public async canActivate(routeParameters: IThinkRouteParameters): Promise<boolean> {
    const solutionUriIsSet: boolean = routeParameters.solutionUri !== undefined;

    const solutionUri: string = solutionUriIsSet
      ? routeParameters.solutionUri
      : window.localStorage.getItem('InternalProcessEngineRoute');

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(solutionUri);

    const noActiveSolution: boolean = this.activeSolutionEntry === undefined;
    if (noActiveSolution) {
      this.notificationService.showNotification(NotificationType.INFO, 'Please open a solution first.');

      return false;
    }

    await this.activeSolutionEntry.service.openSolution(
      this.activeSolutionEntry.uri,
      this.activeSolutionEntry.identity,
    );

    return true;
  }

  public activate(): void {
    this.showDiagramList = true;
  }

  public determineActivationStrategy(): string {
    return activationStrategy.replace;
  }
}
