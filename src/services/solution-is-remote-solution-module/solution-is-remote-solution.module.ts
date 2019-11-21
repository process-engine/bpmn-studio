const httpRegex: RegExp = /^(http|https):\/\/.+/i;

export function solutionIsRemoteSolution(solutionUri: string): boolean {
  return httpRegex.test(solutionUri);
}
