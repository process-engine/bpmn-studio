export function removeMultilineIndent(text: string): string {
  const lines = text.split('\n');
  const firstLine = lines[0] === '' ? lines[1] : lines[0];
  const indent = firstLine.length - firstLine.trimLeft().length;
  const removeIndentRegex = new RegExp(`^( {${indent}})`);

  return lines
    .map((line: string) => line.replace(removeIndentRegex, ''))
    .join('\n')
    .trim();
}
