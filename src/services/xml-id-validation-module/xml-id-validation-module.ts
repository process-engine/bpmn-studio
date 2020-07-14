export function getValidXml(xml: string, illegalIdErrors: Array<any>): any {
  let newXml = xml;
  const renamedIds: Array<any> = [];
  for (const idError of illegalIdErrors) {
    const errorId = (idError.error.message as string).substring(12, idError.error.message.length - 1);
    const qNameRegex: RegExp = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

    const invalidChars = getInvalidCharacters(errorId);

    let newId = errorId;
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
      const escapedRegexString = escapeRegExp(errorId);
      const idRegex = new RegExp(`"${escapedRegexString}"`, 'g');
      newXml = newXml.replace(idRegex, `"${newId}"`);

      renamedIds.push({
        previousId: errorId,
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

function getInvalidCharacters(input: string): Array<string> {
  const qNameValidationRegex: RegExp = /^[\w-.]/i;
  const inputLetters: Array<string> = input.split('');
  const invalidCharacters: Array<string> = inputLetters.filter((letter: string) => {
    const letterIsInvalid: boolean = letter.match(qNameValidationRegex) == null;

    return letterIsInvalid;
  });

  return invalidCharacters;
}
