/* eslint-disable no-underscore-dangle */
export function exposeFunctionForTesting(functionName: string, functionCallback: Function): void {
  const danngerouslyInvokeObjectIsUndefined = (window as any).__dangerouslyInvoke === undefined;

  if (danngerouslyInvokeObjectIsUndefined) {
    (window as any).__dangerouslyInvoke = {};
  }

  (window as any).__dangerouslyInvoke[functionName] = functionCallback;
}

export async function callExposedFunction(functionName: string, ...args: Array<any>): Promise<any> {
  console.log(...args);
  // await (window as any).__dangerouslyInvoke[functionName]('solutionPath', false, 'solutionIdentity');

  return args;
  // done();
}
