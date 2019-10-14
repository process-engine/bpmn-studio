import {IDiagramValidationRules, IDiagramValidationService, IDiagramValidator} from '../../contracts';
import {DiagramValidator} from './diagram-validator';

/**
 * This service provides a fluent API to validate BPMN diagrams.
 *
 * In this service the rules for valid diagrams are defined. Each
 * validation, for example `isBPMN()` is backed by a IValidationRuleSet.
 *
 * A IValidationRuleSet contains one or more IValidationRules and an
 * error message. If one or more rules of the ruleset fail on the
 * input, an error is thrown.
 *
 * To start a validation call `validate(XML)` with the XML string we
 * want to validate. Then invoke the rules you would like to validate,
 * for example `isBPMN()`. After adding all rules, call `throwIfError()`,
 * this will either pass silently or throw a descriptive Error.
 *
 * RuleSets are defined in the `_rules` field of this class.
 */
export class DiagramValidationService implements IDiagramValidationService {
  private rules: IDiagramValidationRules = {
    isXML: {
      rules: [this.hasXMLFileSignature],
      errorMessage: 'Diagram is not a valid XML file.',
    },
    isBPMN: {
      rules: [this.containsBPMN],
      errorMessage: 'Diagram is not a valid BPMN file.',
    },
  };

  public validate(diagramXML: string): IDiagramValidator {
    return new DiagramValidator(this.rules, diagramXML);
  }

  // Business Rules {{{
  private hasXMLFileSignature(content: string): Promise<boolean> {
    const xmlSignature: string = '<?xml ';
    const startsWithSignature: boolean = content.startsWith(xmlSignature);

    return Promise.resolve(startsWithSignature);
  }

  private containsBPMN(content: string): Promise<boolean> {
    const bpmn: string = 'bpmn';
    const containsBPMN: boolean = content.indexOf(bpmn) !== -1;

    return Promise.resolve(containsBPMN);
  }
  // }}} Business Rules
}
