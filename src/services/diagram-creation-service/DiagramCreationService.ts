import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {IDiagramCreationService} from '../../contracts';

export class DiagramCreationService implements IDiagramCreationService {

  public createNewDiagram(solutionBaseUri: string, withName: string): IDiagram {

    const processName: string = withName.trim();
    const homeFolder: string = this._getUserTempFolder();
    const solutionBaseUriIsSingleDiagrams: boolean = solutionBaseUri === 'Single Diagrams';
    const diagramUri: string = solutionBaseUriIsSingleDiagrams
                            ? `${homeFolder}/${processName}.bpmn`
                            : `${solutionBaseUri}/${processName}.bpmn`;
    const processXML: string = this._getInitialProcessXML(processName);

    const diagram: IDiagram = {
      id: processName,
      name: processName,
      uri: diagramUri,
      xml: processXML,
    };

    return diagram;
  }

  private _getInitialProcessXML(processModelId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <bpmn:definitions
      xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
      xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
      xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
      id="Definition_1"
      targetNamespace="http://bpmn.io/schema/bpmn"
      exporter="BPMN Studio"
      exporterVersion="1">
        <bpmn:collaboration id="Collaboration_1cidyxu" name="">
            <bpmn:participant id="Participant_0px403d" name="${processModelId}" processRef="${processModelId}" />
        </bpmn:collaboration>
        <bpmn:process id="${processModelId}" name="${processModelId}" isExecutable="true">
            <bpmn:laneSet>
                <bpmn:lane id="Lane_1xzf0d3" name="Lane">
                    <bpmn:flowNodeRef>
                        StartEvent_1mox3jl
                    </bpmn:flowNodeRef>
                    <bpmn:flowNodeRef>
                        EndEvent_0eie6q6
                    </bpmn:flowNodeRef>
                </bpmn:lane>
            </bpmn:laneSet>
            <bpmn:startEvent id="StartEvent_1mox3jl" name="Start Event">
                <bpmn:outgoing>
                    SequenceFlow_1jdocur
                </bpmn:outgoing>
            </bpmn:startEvent>
            <bpmn:sequenceFlow id="SequenceFlow_1jdocur" sourceRef="StartEvent_1mox3jl" targetRef="EndEvent_0eie6q6" />
            <bpmn:endEvent id="EndEvent_0eie6q6" name="End Event">
                <bpmn:incoming>
                    SequenceFlow_1jdocur
                </bpmn:incoming>
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

  private _getUserTempFolder(): string {
    const os: any = (window as any).nodeRequire('os');
    const path: any = (window as any).nodeRequire('path');
    const fs: any = (window as any).nodeRequire('fs');
    const userHomeDir: string = os.homedir();

    switch (process.platform) {
      case 'darwin':
        const bpmnStudioTempDarwin: string = path.join(userHomeDir, 'Library', 'Application Support', 'bpmn-studio', 'temp-diagrams');
        const bpmnStudioTempDarwinDoesNotExist: boolean = !fs.existsSync(bpmnStudioTempDarwin);

        if (bpmnStudioTempDarwinDoesNotExist) {
          fs.mkdirSync(bpmnStudioTempDarwin);
        }

        return bpmnStudioTempDarwin;
      case 'win32':
        const bpmnStudioTempWin32: string = path.join(userHomeDir, 'AppData', 'Roaming', 'bpmn-studio', 'temp-diagrams');
        const bpmnStudioTempWin32DoesNotExist: boolean = !fs.existsSync(bpmnStudioTempWin32);

        if (bpmnStudioTempWin32DoesNotExist) {
          fs.mkdirSync(bpmnStudioTempWin32);
        }

        return bpmnStudioTempWin32;
      default:
        const bpmnStudioTempLinux: string = path.join(userHomeDir, '.config', 'bpmn-studio', 'temp-diagrams');
        const bpmnStudioTempLinuxDoesNotExist: boolean = !fs.existsSync(bpmnStudioTempLinux);

        if (bpmnStudioTempLinuxDoesNotExist) {
          fs.mkdirSync(bpmnStudioTempLinux);
        }

        return bpmnStudioTempLinux;
    }
  }
}
