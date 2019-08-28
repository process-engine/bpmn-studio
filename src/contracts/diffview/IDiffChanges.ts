import {IChangedElementList, IDiffElementList} from './index';

export interface IDiffChanges {
  /*
   * This contains all Elements that have been added between two diagrams.
   */
  _added: IDiffElementList;

  /*
   * This contains all Elements that have been changed between two diagrams.
   */
  _changed: IChangedElementList;

  /*
   * This contains all Elements thats layout has been changed between two diagrams.
   */
  _layoutChanged: IDiffElementList;

  /*
   * This contains all Elements that have been removed between two diagrams.
   */
  _removed: IDiffElementList;
}
