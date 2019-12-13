export enum StudioVersion {
  Dev = 'dev',
  Alpha = 'alpha',
  Beta = 'beta',
  Stable = 'stable',
}

export interface ISupportedBPMNElementWithEventDefinitionsList {
  [name: string]: Array<string>;
}

export const SupportedBPMNElementsWithEventDefinitions: ISupportedBPMNElementWithEventDefinitionsList = {
  'bpmn:StartEvent': ['', 'bpmn:MessageEventDefinition', 'bpmn:TimerEventDefinition', 'bpmn:SignalEventDefinition'],
  'bpmn:Task': [''],
  'bpmn:UserTask': [''],
  'bpmn:ManualTask': [''],
  'bpmn:ReceiveTask': [''],
  'bpmn:SendTask': [''],
  'bpmn:ScriptTask': [''],
  'bpmn:ServiceTask': [''],
  'bpmn:EndEvent': [
    '',
    'bpmn:MessageEventDefinition',
    'bpmn:SignalEventDefinition',
    'bpmn:ErrorEventDefinition',
    'bpmn:TerminateEventDefinition',
  ],
  'bpmn:CallActivity': [''],
  'bpmn:Lane': [''],
  'bpmn:Participant': [''],
  'bpmn:BoundaryEvent': [
    '',
    'bpmn:MessageEventDefinition',
    'bpmn:TimerEventDefinition',
    'bpmn:SignalEventDefinition',
    'bpmn:ErrorEventDefinition',
  ],
  'bpmn:IntermediateThrowEvent': [
    '',
    'bpmn:MessageEventDefinition',
    'bpmn:LinkEventDefinition',
    'bpmn:SignalEventDefinition',
  ],
  'bpmn:IntermediateCatchEvent': [
    '',
    'bpmn:MessageEventDefinition',
    'bpmn:LinkEventDefinition',
    'bpmn:SignalEventDefinition',
    'bpmn:TimerEventDefinition',
  ],
  'bpmn:ExclusiveGateway': [''],
  'bpmn:ParallelGateway': [''],
  'bpmn:SequenceFlow': [''],
  'bpmn:SubProcess': [''],
  'bpmn:Association': [''],
  'bpmn:TextAnnotation': [''],
  label: [''],
};
