import {IShape} from '@process-engine/bpmn-elements_contracts';

import {IOverlayDescriptor} from './IOverlayDescriptor';
import {IOverlay, IOverlays} from './index';

export interface IOverlayManager {
  _overlays: IOverlays;

  add(elementOrElementId: string | IShape, overlayDescriptor: IOverlayDescriptor | IOverlay): void;
  remove(overlayId: string | IShape): void;
  clear(): void;
}
