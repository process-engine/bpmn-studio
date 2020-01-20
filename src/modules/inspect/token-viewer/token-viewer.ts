import {bindable, inject} from 'aurelia-framework';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {ISolutionEntry} from '../../../contracts';
import {IPayloadEntry, IPayloadEntryValue, IRawTokenEntry, ITokenEntry, ITokenViewerService} from './contracts/index';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';

// tslint:disable: no-magic-numbers

const versionRegex: RegExp = /(\d+)\.(\d+).(\d+)/;

@inject('TokenViewerService')
export class TokenViewer {
  @bindable()
  public activeDiagram: IDiagram;

  @bindable() public activeSolutionEntry: ISolutionEntry;
  @bindable() public flowNode: IShape;
  @bindable() public token: string;
  @bindable() public showBeautifiedToken: boolean = true;
  @bindable({changeHandler: 'processInstanceIdOrCorrelationIdChanged'})
  public processInstanceId: string;

  @bindable({changeHandler: 'processInstanceIdOrCorrelationIdChanged'})
  public correlationId: string;

  public tokenEntries: Array<ITokenEntry> = [];
  public showTokenEntries: boolean = false;
  public firstElementSelected: boolean = false;
  public shouldShowFlowNodeId: boolean = false;
  public rawTokenEntries: Array<IRawTokenEntry>;

  private tokenViewerService: ITokenViewerService;
  private getTokenHistoryGroup: Promise<DataModels.TokenHistory.TokenHistoryGroup>;

  constructor(tokenViewerService: ITokenViewerService) {
    this.tokenViewerService = tokenViewerService;
  }

  public processInstanceIdOrCorrelationIdChanged(): void {
    const noFlowNodeSelected: boolean = this.flowNode === undefined;
    if (noFlowNodeSelected) {
      return;
    }

    const flowNodeIsSequenceFlow: boolean = this.flowNode.type === 'bpmn:SequenceFlow';
    if (flowNodeIsSequenceFlow) {
      this.shouldShowFlowNodeId = false;
      this.showTokenEntries = false;
      this.tokenEntries = [];
      this.rawTokenEntries = [];

      return;
    }

    this.updateFlowNode();
  }

  public flowNodeChanged(newFlowNode: IShape): Promise<void> {
    const flowNodeCannotHaveTokenHistory: boolean =
      newFlowNode.type === 'bpmn:Participant' ||
      newFlowNode.type === 'bpmn:Collaboration' ||
      newFlowNode.type === 'bpmn:Lane' ||
      newFlowNode.type === 'bpmn:LaneSet' ||
      newFlowNode.type === 'bpmn:SequenceFlow';

    if (flowNodeCannotHaveTokenHistory) {
      this.shouldShowFlowNodeId = false;
      this.showTokenEntries = false;
      this.tokenEntries = [];
      this.rawTokenEntries = [];

      return;
    }

    this.updateFlowNode();
  }

  private async updateFlowNode(): Promise<void> {
    this.firstElementSelected = true;
    this.tokenEntries = [];

    if (!solutionIsRemoteSolution(this.activeSolutionEntry.uri)) {
      this.clearTokenViewer();

      return;
    }

    if (this.processEngineSupportsFetchingTokensByProcessInstanceId()) {
      const noProcessInstanceId: boolean = this.processInstanceId === undefined;
      const noCorrelationId: boolean = this.correlationId === undefined;
      if (noProcessInstanceId || noCorrelationId) {
        this.clearTokenViewer();

        return;
      }

      this.getTokenHistoryGroup = this.tokenViewerService.getTokenForFlowNodeByProcessInstanceId(
        this.processInstanceId,
        this.flowNode.id,
        this.activeSolutionEntry.identity,
      );
    } else {
      const noCorrelationId: boolean = this.correlationId === undefined;
      if (noCorrelationId) {
        this.clearTokenViewer();

        return;
      }

      this.getTokenHistoryGroup = this.tokenViewerService.getTokenForFlowNodeInstance(
        this.activeDiagram.id,
        this.correlationId,
        this.flowNode.id,
        this.activeSolutionEntry.identity,
      );
    }

    const tokenHistoryGroup: DataModels.TokenHistory.TokenHistoryGroup = await this.getTokenHistoryGroup;

    this.tokenEntries = this.getBeautifiedTokenEntriesForFlowNode(tokenHistoryGroup);
    this.rawTokenEntries = this.getRawTokenEntriesForFlowNode(tokenHistoryGroup);

    this.showTokenEntries = this.tokenEntries.length > 0;
    this.shouldShowFlowNodeId = this.tokenEntries.length > 0;
  }

  private clearTokenViewer(): void {
    this.tokenEntries = undefined;
    this.rawTokenEntries = undefined;
    this.showTokenEntries = false;
    this.shouldShowFlowNodeId = false;
  }

  private processEngineSupportsFetchingTokensByProcessInstanceId(): boolean {
    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;

    const noProcessEngineVersionSet: boolean = processEngineVersion === undefined;
    if (noProcessEngineVersionSet) {
      return false;
    }

    const regexResult: RegExpExecArray = versionRegex.exec(processEngineVersion);
    const majorVersion: number = parseInt(regexResult[1]);
    const minorVersion: number = parseInt(regexResult[2]);

    // The version must be 8.1.0 or later
    const processEngineSupportsEvents: boolean = majorVersion > 8 || (majorVersion === 8 && minorVersion >= 1);

    return processEngineSupportsEvents;
  }

  private getRawTokenEntriesForFlowNode(
    tokenHistoryGroup: DataModels.TokenHistory.TokenHistoryGroup,
  ): Array<IRawTokenEntry> {
    const tokenEntries: Array<IRawTokenEntry> = [];

    const elementHasNoToken: boolean = tokenHistoryGroup === undefined;
    if (elementHasNoToken) {
      return [];
    }

    Object.entries(tokenHistoryGroup).forEach(
      ([flowNodeId, tokenHistoryEntries]: [string, DataModels.TokenHistory.TokenHistoryEntryList]) => {
        tokenHistoryEntries.tokenHistoryEntries.forEach(
          (historyEntry: DataModels.TokenHistory.TokenHistoryEntry, index: number) => {
            // tslint:disable-next-line no-magic-numbers
            const payloadAsString: string = JSON.stringify(historyEntry.payload, null, 2);

            const tokenEntry: IRawTokenEntry = {
              entryNr: index,
              eventType: historyEntry.tokenEventType,
              createdAt: historyEntry.createdAt,
              payload: payloadAsString,
            };

            tokenEntries.push(tokenEntry);
          },
        );
      },
    );

    return tokenEntries;
  }

  private getBeautifiedTokenEntriesForFlowNode(
    tokenHistoryGroup: DataModels.TokenHistory.TokenHistoryGroup,
  ): Array<ITokenEntry> {
    const tokenEntries: Array<ITokenEntry> = [];

    const elementHasNoToken: boolean = tokenHistoryGroup === undefined;
    if (elementHasNoToken) {
      return [];
    }

    Object.entries(tokenHistoryGroup).forEach(
      ([flowNodeId, tokenHistoryEntries]: [string, DataModels.TokenHistory.TokenHistoryEntryList]) => {
        tokenHistoryEntries.tokenHistoryEntries.forEach(
          (historyEntry: DataModels.TokenHistory.TokenHistoryEntry, index: number) => {
            const historyEntryPayload: any = historyEntry.payload;

            const historyEntryHasNoPayload: boolean = historyEntryPayload === undefined;
            if (historyEntryHasNoPayload) {
              return;
            }

            const tokenEntryPayload: Array<IPayloadEntry> = this.convertHistoryEntryPayloadToTokenEntryPayload(
              historyEntryPayload,
            );

            const tokenEntry: ITokenEntry = {
              entryNr: index,
              eventType: historyEntry.tokenEventType,
              createdAt: historyEntry.createdAt,
              payload: tokenEntryPayload,
            };

            tokenEntries.push(tokenEntry);
          },
        );
      },
    );

    return tokenEntries;
  }

  private convertHistoryEntryPayloadToTokenEntryPayload(tokenEntryPayload: any): Array<IPayloadEntry> {
    const formattedTokenEntryPayload: Array<IPayloadEntry> = [];

    const payloadIsNotAnObjectOrArray: boolean = typeof tokenEntryPayload !== 'object';
    if (payloadIsNotAnObjectOrArray) {
      const payloadEntry: IPayloadEntry = this.getPayloadEntryForNonObject(tokenEntryPayload);

      formattedTokenEntryPayload.push(payloadEntry);
    } else {
      const payloadEntries: Array<IPayloadEntry> = this.getAllPayloadEntriesForObject(tokenEntryPayload);

      formattedTokenEntryPayload.push(...payloadEntries);
    }

    return formattedTokenEntryPayload;
  }

  private getAllPayloadEntriesForObject(payload: any): Array<IPayloadEntry> {
    const payloadEntries: Array<IPayloadEntry> = [];

    const payloadEntryIndexes: Array<string> = Object.keys(payload);

    for (const payloadIndex of payloadEntryIndexes) {
      const currentLoad: any = payload[payloadIndex];

      const payloadEntry: IPayloadEntry = this.getPayloadEntryForObject(currentLoad, payloadIndex);

      payloadEntries.push(payloadEntry);
    }

    return payloadEntries;
  }

  private getPayloadEntryForObject(load: any, loadName: string): IPayloadEntry {
    const payloadEntry: IPayloadEntry = {
      name: loadName,
      values: [],
    };

    const entryIsNotAnObject: boolean = typeof load !== 'object';
    if (entryIsNotAnObject) {
      const payloadEntryValues: Array<IPayloadEntryValue> = this.getPayloadEntryValuesForNonObject(load);

      payloadEntry.values = payloadEntryValues;
    } else {
      const payloadEntryValues: Array<IPayloadEntryValue> = this.getPayloadEntryValuesForObject(load);

      payloadEntry.values = payloadEntryValues;
    }

    return payloadEntry;
  }

  private getPayloadEntryValuesForObject(payload: any): Array<IPayloadEntryValue> {
    const payloadEntryValues: Array<IPayloadEntryValue> = [];

    const payloadIndexes: Array<string> = Object.keys(payload);

    for (const entryIndex of payloadIndexes) {
      // tslint:disable-next-line no-magic-numbers
      const payloadEntryValue: string = JSON.stringify(payload[entryIndex], null, 2);

      payloadEntryValues.push({
        title: entryIndex,
        value: payloadEntryValue,
      });
    }

    return payloadEntryValues;
  }

  private getPayloadEntryForNonObject(payload: any): IPayloadEntry {
    const payloadEntryValues: any = this.getPayloadEntryValuesForNonObject(payload);

    const payloadEntry: IPayloadEntry = {
      values: payloadEntryValues,
    };

    return payloadEntry;
  }

  private getPayloadEntryValuesForNonObject(payload: any): Array<IPayloadEntryValue> {
    const payloadIsString: boolean = typeof payload === 'string';

    const payloadEntryValue: string = payloadIsString ? `"${payload}"` : payload.toString();

    const payloadEntryValues: Array<IPayloadEntryValue> = [{value: payloadEntryValue}];

    return payloadEntryValues;
  }
}
