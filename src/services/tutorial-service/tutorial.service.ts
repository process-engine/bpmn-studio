import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';

import {NotificationService} from '../notification-service/notification.service';
import {Tutorial} from '../../modules/tutorials/tutorial';
import {LoadDeployStartTutorial} from '../../modules/tutorials/load-deploy-start-tutorial';

@inject(EventAggregator, 'NotificationService', Router)
export class TutorialService {
  private driver: Driver;
  private eventAggregator: EventAggregator;
  private router: Router;
  private notificationService: NotificationService;
  private tutorials: Array<Tutorial> = [];

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService, router: Router) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;

    this.driver = new Driver({
      allowClose: false,
      animate: false,
      showButtons: false,
      padding: 0,
    });

    this.initializeTutorials();
  }

  public initializeTutorials(): void {
    const loadDeployStartTutorial: Tutorial = new LoadDeployStartTutorial(
      this.notificationService,
      this.eventAggregator,
      this.router,
      this.driver,
    );

    this.tutorials.push(loadDeployStartTutorial);
  }

  public getAllTutorials(): Array<Tutorial> {
    return this.tutorials;
  }

  public getTutorial(index): Tutorial {
    return this.tutorials[index];
  }
}
