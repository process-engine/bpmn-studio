/* eslint-disable no-underscore-dangle */
export function exposeFunctionForTesting(functionName: string, functionCallback: Function): void {
  const dangerouslyInvokeObjectIsUndefined = (window as any).__dangerouslyInvoke === undefined;

  if (dangerouslyInvokeObjectIsUndefined) {
    (window as any).__dangerouslyInvoke = {};
  }

  (window as any).__dangerouslyInvoke[functionName] = functionCallback;
}

export async function callExposedFunction(
  webdriverClient: any,
  functionName: string,
  ...args: Array<any>
): Promise<any> {
  const result = await webdriverClient.executeAsync(
    async (exposedFunctionName, ...params) => {
      const exposedFunctionResult = await (window as any).__dangerouslyInvoke[exposedFunctionName](...params);

      const doneFunctionIndex = params.length - 1;
      const done = params[doneFunctionIndex];

      done(exposedFunctionResult);
    },
    functionName,
    ...args,
  );

  return result;
}
