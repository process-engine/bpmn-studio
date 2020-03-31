import {inject} from 'aurelia-framework';

import uuid from 'node-uuid';

import {IModdleElement, IProcessRef} from '@process-engine/bpmn-elements_contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IBpmnModeler, IDiagramCreationService, NotificationType} from '../../contracts/index';
import {NotificationService} from '../notification-service/notification.service';

@inject('NotificationService')
export class DiagramCreationService implements IDiagramCreationService {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  public async createNewDiagram(solutionBaseUri: string, withName: string, xml?: string): Promise<IDiagram> {
    const processName: string = withName.trim();
    const diagramUri: string = `${solutionBaseUri}/${processName}.bpmn`;

    const xmlGiven: boolean = xml !== undefined;
    const processXML: string = xmlGiven
      ? await this.renameDiagram(xml, withName)
      : this.getInitialProcessXML(processName);

    const diagram: IDiagram = {
      id: processName,
      name: processName,
      uri: diagramUri,
      xml: processXML,
    };

    return diagram;
  }

  private async renameDiagram(xml: string, name: string): Promise<string> {
    // eslint-disable-next-line 6river/new-cap
    const modeler: IBpmnModeler = new bundle.modeler({
      moddleExtensions: {
        camunda: bundle.camundaModdleDescriptor,
      },
    });

    modeler.importXML(xml, (error: Error) => {
      const errorOccured: boolean = error !== undefined;
      if (errorOccured) {
        this.notificationService.showNotification(NotificationType.ERROR, `Failed to copy diagram. ${error.message}`);
      }
    });

    const promise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      modeler.on('import.done', () => {
        // eslint-disable-next-line no-underscore-dangle
        const rootElements: Array<IModdleElement> = modeler._definitions.rootElements;
        const process: IProcessRef = rootElements.find((element: IModdleElement) => {
          return element.$type === 'bpmn:Process';
        }) as IProcessRef;

        process.id = name;
        process.name = name;

        const collaboration: IModdleElement = rootElements.find((element: IModdleElement) => {
          return element.$type === 'bpmn:Collaboration';
        });
        const participant: IModdleElement = collaboration.participants[0];

        participant.name = name;
        participant.processRef = process;

        modeler.saveXML({}, (error: Error, result: string) => {
          const errorOccured: boolean = error !== undefined;
          if (errorOccured) {
            this.notificationService.showNotification(
              NotificationType.ERROR,
              `Failed to copy the diagram. Cause: ${error.message}`,
            );

            reject(error);

            return;
          }

          resolve(result);
        });
      });
    });

    return promise;
  }

  private getInitialProcessXML(processModelId: string): string {
    const definitionId = uuid.v4();

    return `<?xml version="1.0" encoding="UTF-8"?>
    <bpmn:definitions
      xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
      xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
      id="${definitionId}"
      targetNamespace="http://bpmn.io/schema/bpmn"
      exporter="BPMN Studio"
      exporterVersion="1">
      <bpmn:collaboration id="Collaboration_1cidyxu" name="">
        <bpmn:participant id="Participant_0px403d" name="${processModelId}" processRef="${processModelId}" />
      </bpmn:collaboration>
      <bpmn:process id="${processModelId}" name="${processModelId}" isExecutable="true">
        <bpmn:laneSet>
          <bpmn:lane id="Lane_1xzf0d3" name="Lane">
            <bpmn:flowNodeRef>StartEvent_1mox3jl</bpmn:flowNodeRef>
            <bpmn:flowNodeRef>EndEvent_0eie6q6</bpmn:flowNodeRef>
          </bpmn:lane>
        </bpmn:laneSet>
        <bpmn:startEvent id="StartEvent_1mox3jl" name="Start Event">
          <bpmn:outgoing>SequenceFlow_1jdocur</bpmn:outgoing>
        </bpmn:startEvent>
        <bpmn:sequenceFlow id="SequenceFlow_1jdocur" sourceRef="StartEvent_1mox3jl" targetRef="EndEvent_0eie6q6" />
        <bpmn:endEvent id="EndEvent_0eie6q6" name="End Event">
          <bpmn:incoming>SequenceFlow_1jdocur</bpmn:incoming>
        </bpmn:endEvent>
      </bpmn:process>
      <bpmndi:BPMNDiagram id="BPMNDiagram_1">
        <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1cidyxu">
          <bpmndi:BPMNShape id="Participant_0px403d_di" bpmnElement="Participant_0px403d">
            <dc:Bounds x="5" y="4" width="581" height="170" />
          </bpmndi:BPMNShape>
          <bpmndi:BPMNShape id="Lane_1xzf0d3_di" bpmnElement="Lane_1xzf0d3">
            <dc:Bounds x="35" y="4" width="551" height="170" />
          </bpmndi:BPMNShape>
          <bpmndi:BPMNShape id="StartEvent_1mox3jl_di" bpmnElement="StartEvent_1mox3jl">
            <dc:Bounds x="83" y="69" width="36" height="36" />
          </bpmndi:BPMNShape>
          <bpmndi:BPMNShape id="EndEvent_0eie6q6_di" bpmnElement="EndEvent_0eie6q6">
            <dc:Bounds x="503" y="69" width="36" height="36" />
          </bpmndi:BPMNShape>
          <bpmndi:BPMNEdge id="SequenceFlow_1jdocur_di" bpmnElement="SequenceFlow_1jdocur">
            <di:waypoint x="119" y="87" />
            <di:waypoint x="503" y="87" />
          </bpmndi:BPMNEdge>
        </bpmndi:BPMNPlane>
      </bpmndi:BPMNDiagram>
    </bpmn:definitions>`;
  }
}
