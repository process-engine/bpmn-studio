import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';

import {IModdleElement} from '@process-engine/bpmn-elements_contracts';
import environment from '../../environment';
import {SolutionService} from '../solution-service/solution.service';
import {
  DeployResult,
  IBpmnModdle,
  IBpmnModeler,
  IDefinition,
  ISolutionEntry,
  NotificationType,
} from '../../contracts/index';
import {NotificationService} from '../notification-service/notification.service';

@inject(EventAggregator, 'SolutionService', Router, 'NotificationService')
export class DeployDiagramService {
  private router: Router;
  private eventAggregator: EventAggregator;
  private notificationService: NotificationService;

  private solutionService: SolutionService;

  private modeler: IBpmnModeler;
  private moddle: IBpmnModdle;

  constructor(
    eventAggregator: EventAggregator,
    solutionService: SolutionService,
    router: Router,
    notificationService: NotificationService,
  ) {
    this.eventAggregator = eventAggregator;
    this.solutionService = solutionService;
    this.router = router;
    this.notificationService = notificationService;

    // eslint-disable-next-line 6river/new-cap
    this.modeler = new bundle.modeler({
      moddleExtensions: {
        camunda: bundle.camundaModdleDescriptor,
      },
    });

    this.moddle = this.modeler.get('moddle');
  }

  public async deployDiagram(solution: ISolutionEntry, diagram: IDiagram, xml?: string): Promise<DeployResult> {
    const diagramHasChanges: boolean = xml !== undefined;
    if (diagramHasChanges) {
      diagram.xml = xml;
    }

    const remoteSolutionToDeployTo: ISolutionEntry = await this.getRemoteSolutionToDeployTo();
    if (remoteSolutionToDeployTo === undefined) {
      return undefined;
    }

    return this.uploadProcess(remoteSolutionToDeployTo, diagram);
  }

  private async uploadProcess(solutionToDeployTo: ISolutionEntry, diagram: IDiagram): Promise<DeployResult> {
    const processModelId: string = await this.getProcessModelIdForXml(diagram.xml);

    const diagramIsAlreadyDeployed: boolean = await this.diagramIsAlreadyDeployed(solutionToDeployTo, processModelId);
    if (diagramIsAlreadyDeployed) {
      const shouldOverwriteDiagram: boolean = await this.shouldOverwriteDiagram();

      if (!shouldOverwriteDiagram) {
        return undefined;
      }
    }

    try {
      diagram.id = processModelId;

      const bpmnFileSuffix: string = '.bpmn';

      const diagramUriWithoutSuffix: string = diagram.uri.endsWith(bpmnFileSuffix)
        ? diagram.uri.slice(0, bpmnFileSuffix.length)
        : diagram.uri;

      const copyOfDiagram: IDiagram = {
        id: diagram.id,
        name: diagram.name,
        uri: diagramUriWithoutSuffix,
        xml: diagram.xml,
      };

      await solutionToDeployTo.service.saveDiagram(copyOfDiagram, solutionToDeployTo.uri);

      const deployedDiagram: IDiagram = await solutionToDeployTo.service.loadDiagram(processModelId);

      this.notificationService.showNotification(
        NotificationType.SUCCESS,
        'Diagram was successfully uploaded to the connected ProcessEngine.',
      );

      this.eventAggregator.publish(environment.events.diagramDetail.onDiagramDeployed, processModelId);

      return {
        diagram: deployedDiagram,
        solution: solutionToDeployTo,
      };
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, `Unable to update diagram: ${error}`);

      return undefined;
    }
  }

  private async getProcessModelIdForXml(xml: string): Promise<string> {
    try {
      const {rootElement: definitions} = await this.moddle.fromXML(xml);

      const rootElements: Array<IModdleElement> = definitions.rootElements;

      const processModel: IModdleElement = rootElements.find((definition: IModdleElement) => {
        return definition.$type === 'bpmn:Process';
      });
      const processModelId: string = processModel.id;

      return Promise.resolve(processModelId);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private async diagramIsAlreadyDeployed(solution: ISolutionEntry, processModelId: string): Promise<boolean> {
    try {
      await solution.service.loadDiagram(processModelId);

      return true;
    } catch {
      return false;
    }
  }

  private get multipleRemoteSolutionsExist(): boolean {
    const remoteSolutions = this.solutionService.getRemoteSolutionEntries();

    return remoteSolutions.length > 1;
  }

  private get firstRemoteSolution(): ISolutionEntry {
    const remoteSolutions = this.solutionService.getRemoteSolutionEntries();

    return remoteSolutions[0];
  }

  private shouldOverwriteDiagram(): Promise<boolean> {
    return new Promise((resolve: Function): void => {
      this.eventAggregator.publish(
        environment.events.deployModals.showOverwriteDiagramModal,
        (shouldOverwrite: boolean) => {
          resolve(shouldOverwrite);
        },
      );
    });
  }

  private getRemoteSolutionToDeployTo(): Promise<ISolutionEntry> {
    return new Promise((resolve: Function): void => {
      if (this.multipleRemoteSolutionsExist) {
        this.eventAggregator.publish(
          environment.events.deployModals.showRemoteSolutionSelectionModal,
          (selectedRemoteSolution: ISolutionEntry) => {
            resolve(selectedRemoteSolution);
          },
        );
      } else {
        resolve(this.firstRemoteSolution);
      }
    });
  }
}
