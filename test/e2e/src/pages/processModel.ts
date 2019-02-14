import {browser} from 'protractor';
import {HttpClient} from 'protractor-http-client';

export class ProcessModel {
  // Define Instances
  private _processEngineUrl: string = browser.params.processEngineUrl;
  private _http: HttpClient = new HttpClient(this._processEngineUrl);

  // Define Links, Urls, Classes
  // tslint:disable-next-line:no-magic-numbers
  private _processModelId: string = 'TA_' + Math.floor(Math.random() * 1000000);
  private _correlationId: string;
  private _processInstanceId: string;

  // Define Elements

  // Define Functions
  public static getProcessModelLink(): string {
    return '/think';
  }

  public static getProcessModelUrl(): string {
    return '/design';
  }

  public static userTasksUrl(correlationId: string): string {
    return '/correlation/' + correlationId + '/task';
  }

  public static userTasksUrlWithProcessInstance(processInstanceId: string): string {
    return '/instance/' + processInstanceId + '/task';
  }

  public static liveExecutionTrackerUrl(processModelId: string, correlationId: string, processInstanceId: string): string {
    return `/correlation/${correlationId}/diagram/${processModelId}/instance/${processInstanceId}/live-execution-tracker`;
  }

  public static liveExecutionTrackerUrlWithTaskPreselection(correlationId: string, processModelId: string, processInstanceId: string): string {
    return `/correlation/${correlationId}/diagram/${processModelId}/instance/${processInstanceId}/live-execution-tracker`;
  }

  public getProcessModelId(): string {
    return this._processModelId;
  }

  public getCorrelationId(): string {
    return this._correlationId;
  }

  public getProcessInstanceId(): string {
    return this._processInstanceId;
  }

  public postProcessModel(processModel?: string): void {
    let currentModel: string = this.getProcessModelId();
    if (processModel !== undefined) {
      currentModel = processModel;
    }
    const requestDestination: string = `/api/management/v1/process_models/${currentModel}/update`;
    const requestPayload: any = {
      xml: '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" ' +
        'xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" ' +
        'xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" ' +
        'id=\"Definition_1\" targetNamespace=\"http://bpmn.io/schema/bpmn\" exporter=\"BPMN Studio\" exporterVersion=\"1\">' +
        '<bpmn:collaboration id=\"Collaboration_1cidyxu\" name=\"\"><bpmn:participant id=\"Participant_0px403d\" name=\"' +
        currentModel + '\" processRef=\"' + currentModel + '\" /></bpmn:collaboration><bpmn:process id=\"' + currentModel +
        '\" name=\"' + currentModel + '\" isExecutable=\"true\"><bpmn:laneSet><bpmn:lane id=\"Lane_1xzf0d3\" name=\"Lane\">' +
        '<bpmn:flowNodeRef>StartEvent_1mox3jl</bpmn:flowNodeRef><bpmn:flowNodeRef>EndEvent_0eie6q6</bpmn:flowNodeRef>' +
        '<bpmn:flowNodeRef>Task_0z3p6gi</bpmn:flowNodeRef></bpmn:lane></bpmn:laneSet><bpmn:startEvent id=\"StartEvent_1mox3jl\"' +
        ' name=\"Start Event\"><bpmn:outgoing>SequenceFlow_1jdocur</bpmn:outgoing><bpmn:outgoing>SequenceFlow_0y5m38r</bpmn:outgoing>' +
        '</bpmn:startEvent><bpmn:sequenceFlow id=\"SequenceFlow_1jdocur\" name=\"\" sourceRef=\"StartEvent_1mox3jl\" ' +
        'targetRef=\"EndEvent_0eie6q6\" /><bpmn:endEvent id=\"EndEvent_0eie6q6\" name=\"End Event\"><bpmn:incoming>SequenceFlow_1jdocur' +
        '</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id=\"SequenceFlow_0y5m38r\" sourceRef=\"StartEvent_1mox3jl\" ' +
        'targetRef=\"Task_0z3p6gi\" /><bpmn:scriptTask id=\"Task_0z3p6gi\" name=\"Hello\"><bpmn:incoming>SequenceFlow_0y5m38r' +
        '</bpmn:incoming><bpmn:script>console.log(\"Hello World\")</bpmn:script></bpmn:scriptTask></bpmn:process><bpmndi:BPMNDiagram ' +
        'id=\"BPMNDiagram_1\"><bpmndi:BPMNPlane id=\"BPMNPlane_1\" bpmnElement=\"Collaboration_1cidyxu\"><bpmndi:BPMNShape ' +
        'id=\"Participant_0px403d_di\" bpmnElement=\"Participant_0px403d\"><dc:Bounds x=\"5\" y=\"4\" width=\"581\" height=\"170\" ' +
        '/></bpmndi:BPMNShape><bpmndi:BPMNShape id=\"Lane_1xzf0d3_di\" bpmnElement=\"Lane_1xzf0d3\"><dc:Bounds x=\"35\" y=\"4\" ' +
        'width=\"551\" height=\"170\" /></bpmndi:BPMNShape><bpmndi:BPMNShape id=\"StartEvent_1mox3jl_di\" bpmnElement=\"StartEvent_1mox3jl\">' +
        '<dc:Bounds x=\"83\" y=\"69\" width=\"36\" height=\"36\" /></bpmndi:BPMNShape><bpmndi:BPMNShape id=\"EndEvent_0eie6q6_di\" ' +
        'bpmnElement=\"EndEvent_0eie6q6\"><dc:Bounds x=\"503\" y=\"69\" width=\"36\" height=\"36\" /></bpmndi:BPMNShape><bpmndi:BPMNEdge ' +
        'id=\"SequenceFlow_1jdocur_di\" bpmnElement=\"SequenceFlow_1jdocur\"><di:waypoint x=\"119\" y=\"87\" /><di:waypoint x=\"503\" y=\"87\" ' +
        '/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id=\"SequenceFlow_0y5m38r_di\" bpmnElement=\"SequenceFlow_0y5m38r\"><di:waypoint x=\"119\" ' +
        'y=\"87\" /><di:waypoint x=\"169\" y=\"87\" /></bpmndi:BPMNEdge><bpmndi:BPMNShape id=\"ScriptTask_188qtll_di\" ' +
        'bpmnElement=\"Task_0z3p6gi\"><dc:Bounds x=\"169\" y=\"47\" width=\"100\" height=\"80\" /></bpmndi:BPMNShape>' +
        '</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
    };
    const requestHeaders: any = {
      authorization: 'Bearer ZHVtbXlfdG9rZW4=',
    };

    this._http.post(requestDestination, requestPayload, requestHeaders);
  }

  public async deleteProcessModel(): Promise<void> {

    const requestDestination: string = `/api/management/v1/process_models/${this._processModelId}/delete`;
    const requestHeaders: any = {
      authorization: 'Bearer ZHVtbXlfdG9rZW4=',
    };

    await this._http.get(requestDestination, requestHeaders);
  }

  public postProcessModelWithUserTask(processModel?: string): void {
    let currentModel: string = this.getProcessModelId();
    if (processModel !== undefined) {
      currentModel = processModel;
    }

    const requestDestination: string = `/api/management/v1/process_models/${currentModel}/update`;
    const requestPayload: any = {

      // tslint:disable-next-line:max-line-length
      xml: `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
      xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definition_1" targetNamespace="http://bpmn.io/schema/bpmn"
      exporter="BPMN Studio" exporterVersion="1">
        <bpmn:collaboration id="Collaboration_1cidyxu" name="">
          <bpmn:participant id="Participant_0px403d" name="${currentModel}" processRef="${currentModel}" />
        </bpmn:collaboration>
        <bpmn:process id="${currentModel}" name="${currentModel}" isExecutable="true">
          <bpmn:laneSet>
            <bpmn:lane id="Lane_1xzf0d3" name="Lane">
              <bpmn:flowNodeRef>StartEvent_1mox3jl</bpmn:flowNodeRef>
              <bpmn:flowNodeRef>EndEvent_0eie6q6</bpmn:flowNodeRef>
              <bpmn:flowNodeRef>Task_1adxlm1</bpmn:flowNodeRef>
            </bpmn:lane>
          </bpmn:laneSet>
          <bpmn:startEvent id="StartEvent_1mox3jl" name="Start Event">
            <bpmn:outgoing>SequenceFlow_04ksesr</bpmn:outgoing>
          </bpmn:startEvent>
          <bpmn:endEvent id="EndEvent_0eie6q6" name="End Event">
            <bpmn:incoming>SequenceFlow_197qjgi</bpmn:incoming>
          </bpmn:endEvent>
          <bpmn:sequenceFlow id="SequenceFlow_04ksesr" sourceRef="StartEvent_1mox3jl" targetRef="Task_1adxlm1" />
          <bpmn:sequenceFlow id="SequenceFlow_197qjgi" sourceRef="Task_1adxlm1" targetRef="EndEvent_0eie6q6" />
          <bpmn:userTask id="Task_1adxlm1" name="">
            <bpmn:incoming>SequenceFlow_04ksesr</bpmn:incoming>
            <bpmn:outgoing>SequenceFlow_197qjgi</bpmn:outgoing>
          </bpmn:userTask>
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
            <bpmndi:BPMNEdge id="SequenceFlow_04ksesr_di" bpmnElement="SequenceFlow_04ksesr">
              <di:waypoint x="119" y="87" />
              <di:waypoint x="242" y="87" />
            </bpmndi:BPMNEdge>
            <bpmndi:BPMNEdge id="SequenceFlow_197qjgi_di" bpmnElement="SequenceFlow_197qjgi">
              <di:waypoint x="342" y="87" />
              <di:waypoint x="503" y="87" />
            </bpmndi:BPMNEdge>
            <bpmndi:BPMNShape id="UserTask_1luo32z_di" bpmnElement="Task_1adxlm1">
              <dc:Bounds x="242" y="47" width="100" height="80" />
            </bpmndi:BPMNShape>
          </bpmndi:BPMNPlane>
        </bpmndi:BPMNDiagram>
      </bpmn:definitions>
      `,
    };
    const requestHeaders: any = {
      authorization: 'Bearer ZHVtbXlfdG9rZW4=',
    };

    this._http.post(requestDestination, requestPayload, requestHeaders);
  }

  public startProcess(processModel?: string): void {
    let currentModel: string = this.getProcessModelId();
    if (processModel !== undefined) {
      currentModel = processModel;
    }

    const requestDestination: string =
      `/api/management/v1/process_models/${currentModel}/start_events/StartEvent_1mox3jl/start?start_callback_type=1`;

    const requestPayload: any = {};
    const requestHeaders: any = {
      authorization: 'Bearer ZHVtbXlfdG9rZW4=',
    };

    this._http.post(requestDestination, requestPayload, requestHeaders).jsonBody.then((jsonBody: JSON) => {
      this._correlationId = jsonBody['correlationId'];
      this._processInstanceId = jsonBody['processInstanceId'];
    });

  }
}
