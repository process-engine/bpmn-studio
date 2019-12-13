import {SupportedBPMNElementListEntry} from './SupportedBPMNElementListEntry';

export const SupportedBPMNElements: Array<SupportedBPMNElementListEntry> = [
  {
    type: 'bpmn:StartEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:TimerEventDefinition',
      'bpmn:SignalEventDefinition',
    ],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:Task',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:UserTask',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:ManualTask',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:ReceiveTask',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:SendTask',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:ScriptTask',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:ServiceTask',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
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
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:CallActivity',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:Lane',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:Participant',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
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
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:IntermediateThrowEvent',
    supportedEventDefinitions: [
      '',
      'bpmn:MessageEventDefinition',
      'bpmn:LinkEventDefinition',
      'bpmn:SignalEventDefinition',
    ],
    unsupportedVariables: [],
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
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:ExclusiveGateway',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:ParallelGateway',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:SequenceFlow',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:SubProcess',
    supportedEventDefinitions: [''],
    unsupportedVariables: ['triggeredByEvent'],
  },
  {
    type: 'bpmn:Association',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'bpmn:TextAnnotation',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
  {
    type: 'label',
    supportedEventDefinitions: [''],
    unsupportedVariables: [],
  },
];
