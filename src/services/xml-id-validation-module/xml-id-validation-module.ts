export function getIllegalIdErrors(warnings: Array<any>): Array<any> {
  if (warnings.length !== 0) {
    const illegalIdErrors = warnings.filter((warning) => {
      return warning.error?.message?.startsWith('illegal ID');
    });

    return illegalIdErrors;
  }

  return [];
}

export function getValidXml(xml: string, illegalIdErrors: Array<any>): any {
  let newXml = xml;
  const renamedIds: Array<any> = [];
  for (const illegalIdError of illegalIdErrors) {
    /**
     * The error message e.g. looks like "illegal ID <Auf Rückmeldung warten>"
     *  We need to get the ID between the "<>" characters. It starts after the first 12 characters.
     */
    const idStartIndex = 12;
    const idEndIndex = illegalIdError.error.message.length - 1;
    const idWhichCausedTheError = illegalIdError.error.message.substring(idStartIndex, idEndIndex);
    const qNameRegex: RegExp = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

    const invalidChars = getInvalidCharacters(idWhichCausedTheError);

    let newId = idWhichCausedTheError;
    for (const invalidChar of invalidChars) {
      newId = newId.replace(invalidChar, '_');
    }

    const invalidFirstCharacterRegex: RegExp = /^[\d-.:]/i;
    if (newId.match(invalidFirstCharacterRegex) != null) {
      newId = `_${newId}`;
    }

    const endsWithAllowedCharactersRegex: RegExp = /[\w-.]*$/i;
    if (!endsWithAllowedCharactersRegex.test(newId)) {
      newId = `${newId}_`;
    }

    if (qNameRegex.test(newId)) {
      const escapedRegexString = escapeRegExp(idWhichCausedTheError);
      const idRegex = new RegExp(`(id|Ref|bpmnElement)="${escapedRegexString}"`, 'g');
      const flowNodeRefRegex = new RegExp(`Ref>${escapedRegexString}<`, 'g');

      newXml = newXml.replace(idRegex, `$1="${newId}"`);
      newXml = newXml.replace(flowNodeRefRegex, `Ref>${newId}<`);

      renamedIds.push({
        previousId: idWhichCausedTheError,
        newId: newId,
      });
    }
  }

  return {
    xml: newXml,
    renamedIds: renamedIds,
  };
}

function escapeRegExp(string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getInvalidCharacters(input: string): Array<string> {
  const qNameValidationRegex: RegExp = /^[\w-.]/i;
  const inputLetters: Array<string> = input.split('');
  const invalidCharacters: Array<string> = inputLetters.filter((letter: string) => {
    const letterIsInvalid: boolean = letter.match(qNameValidationRegex) == null;

    return letterIsInvalid;
  });

  return invalidCharacters;
}
