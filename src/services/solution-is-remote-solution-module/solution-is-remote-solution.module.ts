const httpRegex: RegExp = /^(http|https):\/\//;

export function solutionIsRemoteSolution(solutionUri: string): boolean {
  return httpRegex.test(solutionUri);
}
