// WordPress RSS descriptions arrive double-encoded, so the database stores
// literal entities such as `&#8217;` and `&#8230;`. Decoding at render time
// also repairs rows ingested before this helper existed.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  bull: "•",
  middot: "·",
  deg: "°",
  times: "×",
  divide: "÷",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  dagger: "†",
  permil: "‰",
  prime: "′",
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi;

/**
 * Decode the HTML entities found in feed descriptions. Unknown entities are
 * left intact, and decoding is single-pass so `&amp;#8217;` stays literal
 * text rather than turning into a smart quote.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(
        entity.slice(isHex ? 2 : 1),
        isHex ? 16 : 10,
      );

      if (
        !Number.isInteger(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return match;
      }

      // Match the named-entity handling: non-breaking spaces render as plain
      // spaces so they cannot force awkward wrapping in the card.
      if (codePoint === 0xa0) return " ";

      return String.fromCodePoint(codePoint);
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
