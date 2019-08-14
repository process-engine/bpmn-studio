import {NavigationInstruction} from 'aurelia-router';

/**
 * This interface serves as a type when subscribing to the aurelia router events.
 */
export type AureliaNavigationObject = {
  result: NavigationResult;
  instruction: NavigationInstruction;
};

type NavigationResult = {
  completed: boolean;
  status: string;
};
