export enum StudioVersion {
  Dev = 'dev',
  Alpha = 'alpha',
  Beta = 'beta',
  Stable = 'stable',
}

export type SupportedBPMNElement = {
  type: string;
  supportedEventDefinitions: Array<string>;
};

export const SupportedBPMNElements: Array<SupportedBPMNElement> = [
  {
    type: 'bpmn:StartEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:TimerEventDefinition',
      'bpmn:SignalEventDefinition',
    ],
  },
  {
    type: 'bpmn:Task',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:UserTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ManualTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ReceiveTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:SendTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ScriptTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ServiceTask',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:EndEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:ErrorEventDefinition',
      'bpmn:TerminateEventDefinition',
    ],
  },
  {
    type: 'bpmn:CallActivity',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Lane',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Participant',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:BoundaryEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:TimerEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:ErrorEventDefinition',
    ],
  },
  {
    type: 'bpmn:IntermediateThrowEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:LinkEventDefinition',
      'bpmn:SignalEventDefinition',
    ],
  },
  {
    type: 'bpmn:IntermediateCatchEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:LinkEventDefinition',
      'bpmn:SignalEventDefinition',
      'bpmn:TimerEventDefinition',
    ],
  },
  {
    type: 'bpmn:ExclusiveGateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:ParallelGateway',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:SequenceFlow',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:SubProcess',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:Association',
    supportedEventDefinitions: [''],
  },
  {
    type: 'bpmn:TextAnnotation',
    supportedEventDefinitions: [''],
  },
  {
    type: 'label',
    supportedEventDefinitions: [''],
  },
];
