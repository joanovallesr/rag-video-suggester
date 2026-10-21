/** Collapse insignificant whitespace while preserving single line breaks. */
export function cleanChunk(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
