import {
  IDiagramValidationRule,
  IDiagramValidationRuleSet,
  IDiagramValidationRules,
  IDiagramValidator,
} from '../../contracts';

export class DiagramValidator implements IDiagramValidator {
  private rules: IDiagramValidationRules;
  private diagramXML: string;
  private validations: Array<Promise<void>> = [];

  constructor(rules: IDiagramValidationRules, diagramXML: string) {
    this.rules = rules;
    this.diagramXML = diagramXML;
  }

  public isXML(): IDiagramValidator {
    this.processRuleSet(this.rules.isXML);

    return this;
  }

  public isBPMN(): IDiagramValidator {
    this.processRuleSet(this.rules.isBPMN);

    return this;
  }

  public async throwIfError(): Promise<void> {
    /*
     * We don't use `await Promise.all(this._validations);` here,
     * because we want to await the promises in order.
     *
     * Also .forEach is not possible because of await.
     */
    for (const validation of this.validations) {
      await validation;
    }
  }

  private processRuleSet(ruleSet: IDiagramValidationRuleSet): void {
    const ruleSetPromise: Promise<void> = this.promiseForRuleSet(ruleSet);
    this.validations.push(ruleSetPromise);
  }

  private promiseForRuleSet(ruleSet: IDiagramValidationRuleSet): Promise<void> {
    // Create an array with promises for all validation rules.
    const validationsResultPromise: Array<Promise<boolean>> = ruleSet.rules.map(
      (validationRule: IDiagramValidationRule): Promise<boolean> => {
        return validationRule(this.diagramXML);
      },
    );

    const unifiedPromise: Promise<Array<boolean>> = Promise.all(validationsResultPromise);

    // Create a single promise that will resolve when all validations succeed.
    // It will reject with the ruleset error, if one or more validation did not succeed.
    const ruleSetPromise: Promise<void> = unifiedPromise
      .then((validationResult: Array<boolean>): void => {
        const someValidationsFailed: boolean = validationResult.indexOf(false) !== -1;
        if (someValidationsFailed) {
          throw new Error(ruleSet.errorMessage);
        }
      })
      .catch((error: Error) => {
        throw new Error(`Error during validation: ${error.message}`);
      });

    return ruleSetPromise;
  }
}
