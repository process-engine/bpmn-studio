export type SupportedBPMNElementListEntry = {
  type: string;
  supportedEventDefinitions: Array<string>;
  unsupportedVariables: Array<string>;
};
