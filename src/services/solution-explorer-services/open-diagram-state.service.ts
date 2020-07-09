import * as uuid from 'uuid';

import {IShape} from '@process-engine/bpmn-elements_contracts';

import {DiagramStateChange, IDiagramState, IDiagramStateList, IDiagramStateListEntry} from '../../contracts';

export class OpenDiagramStateService {
  private diagramStatesChangedCallbacks: Map<string, Function> = new Map();

  public saveDiagramState(
    uri: string,
    xml: string,
    location: any,
    selectedElements: Array<IShape>,
    isChanged: boolean,
    change?: DiagramStateChange,
  ): void {
    const diagramState: IDiagramState = {
      data: {
        xml: xml,
      },
      metadata: {
        location: location,
        selectedElements: selectedElements,
        isChanged: isChanged,
        change: change,
      },
    };

    const key: string = this.getLocalStorageKeyByUri(uri);
    const value: string = JSON.stringify(diagramState);

    window.localStorage.setItem(key, value);
    this.fireOnDiagramStatesChanged();
  }

  public updateDiagramState(uri: string, diagramState: IDiagramState): void {
    const key: string = this.getLocalStorageKeyByUri(uri);
    const value: string = JSON.stringify(diagramState);

    window.localStorage.setItem(key, value);
    this.fireOnDiagramStatesChanged();
  }

  public loadDiagramState(uri: string): IDiagramState | null {
    const key: string = this.getLocalStorageKeyByUri(uri);

    const dataFromLocalStorage: string = window.localStorage.getItem(key);

    const noDataFound: boolean = dataFromLocalStorage === null;
    if (noDataFound) {
      return null;
    }

    const diagramState: IDiagramState = JSON.parse(dataFromLocalStorage);

    return diagramState;
  }

  public loadDiagramStateForAllDiagrams(): IDiagramStateList {
    const diagramStateList: IDiagramStateList = [];

    const uriForAllExistingDiagramStates: Array<string> = this.getUrisForAllDiagramStates();

    for (const uri of uriForAllExistingDiagramStates) {
      const diagramState: IDiagramState = this.loadDiagramState(uri);

      const diagramStateListEntry: IDiagramStateListEntry = {
        uri: uri,
        diagramState: diagramState,
      };

      diagramStateList.push(diagramStateListEntry);
    }

    return diagramStateList;
  }

  public deleteDiagramState(uri: string): void {
    const key: string = this.getLocalStorageKeyByUri(uri);

    window.localStorage.removeItem(key);
  }

  public onDiagramStatesChanged(callback): string {
    const callbackId: string = uuid.v4();

    this.diagramStatesChangedCallbacks.set(callbackId, callback);

    return callbackId;
  }

  public removeOnDiagramStatesChangedListener(callbackId: string): void {
    this.diagramStatesChangedCallbacks.delete(callbackId);
  }

  public setDiagramChange(uri: string, change: DiagramStateChange): void {
    const diagramState: IDiagramState | null = this.loadDiagramState(uri);

    if (diagramState === null) {
      throw new Error(`Diagram ${uri} has no state.`);
    }

    diagramState.metadata.change = change;

    this.updateDiagramState(uri, diagramState);
  }

  private fireOnDiagramStatesChanged(): void {
    this.diagramStatesChangedCallbacks.forEach((callback: Function): void => {
      callback();
    });
  }

  private getUrisForAllDiagramStates(): Array<string> {
    const allLocalStorageKeys: Array<string> = Object.keys(localStorage);
    const localStorageKeysForAllDiagramStates: Array<string> = allLocalStorageKeys.filter((key: string) => {
      return key.startsWith(this.getLocalStorageKeyByUri(''));
    });

    const urisForAllDiagramStates: Array<string> = localStorageKeysForAllDiagramStates.map(
      (localStorageKey: string) => {
        return localStorageKey.replace(this.getLocalStorageKeyByUri(''), '');
      },
    );

    return urisForAllDiagramStates;
  }

  private getLocalStorageKeyByUri(uri: string): string {
    return `Open Diagram: ${uri}`;
  }
}
