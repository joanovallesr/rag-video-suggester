import { describe, expect, it } from "vitest";
import { chunkArticles, cleanChunk } from "./chunkArticles";

/** A chunk must never leak HTML markup. */
function assertPlainText(chunk: string) {
  expect(chunk).not.toMatch(/[<>]/);
}

describe("cleanChunk", () => {
  it("collapses runs of spaces and non-breaking spaces", () => {
    expect(cleanChunk("  one \u00a0  two  ")).toBe("one two");
  });

  it("collapses blank lines but keeps single line breaks", () => {
    expect(cleanChunk("alpha\n\n\n beta  \n gamma")).toBe("alpha\nbeta\ngamma");
  });

  it("trims surrounding whitespace and returns empty for blank input", () => {
    expect(cleanChunk("   \n\t ")).toBe("");
  });
});

describe("chunking post bodies", () => {
  it("splits on <h2> and keeps the heading as the first line", () => {
    const chunks = chunkArticles(
      "<p>Intro paragraph.</p>" +
        "<h2>Across</h2><p>1. First clue.</p>" +
        "<h2>Down</h2><p>2. Second clue.</p>",
    );

    expect(chunks).toEqual([
      "Intro paragraph.",
      "Across\n1. First clue.",
      "Down\n2. Second clue.",
    ]);
  });

  it("saves all text before the first heading as its own chunk", () => {
    const chunks = chunkArticles(
      "<p>Preamble one.</p><p>Preamble two.</p>" +
        "<h2>Across</h2><p>1. Clue.</p>",
    );

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe("Preamble one.\nPreamble two.");
  });

  it("omits the intro chunk when the body starts with a heading", () => {
    const chunks = chunkArticles("<h2>Across</h2><p>1. Clue.</p>");

    expect(chunks).toEqual(["Across\n1. Clue."]);
  });

  it("returns a single chunk when there are no headings", () => {
    const chunks = chunkArticles(
      "<p>Only intro text.</p><p>Second paragraph.</p>",
    );

    expect(chunks).toEqual(["Only intro text.\nSecond paragraph."]);
  });

  it("splits on headings of any level (h1-h6)", () => {
    const chunks = chunkArticles(
      "<h3>Across</h3><p>a</p><h4>Down</h4><p>b</p>",
    );

    expect(chunks).toEqual(["Across\na", "Down\nb"]);
  });

  it("recognises real-world Across/Down markers used by the blog", () => {
    // The blog does not use <h2> for section titles. Nested clue wrappers
    // (`div.fts-group` holding a whole clue) must NOT be treated as headings.
    const chunks = chunkArticles(
      '<p>Blog intro.</p>' +
        '<div class="fts fts-list">' +
        '<div class="fts-group">ACROSS</div>' +
        '<div><div class="fts-group">' +
        '<div class="fts-subgroup">1. Clue one</div>' +
        '<div class="fts-subgroup">ANSWER</div>' +
        "</div></div>" +
        '<div class="fts-group">DOWN</div>' +
        '<div><div class="fts-group"><div class="fts-subgroup">2. Clue two</div></div></div>' +
        "</div>",
    );

    expect(chunks).toEqual([
      "Blog intro.",
      "ACROSS\n1. Clue one\nANSWER",
      "DOWN\n2. Clue two",
    ]);
  });

  it("recognises <strong>/<b> and table-cell markers", () => {
    const strong = chunkArticles(
      "<p>Intro.</p><strong>Across</strong><br />1. Alpha<br />2. Beta<br />" +
        "<strong>Down</strong><br />3. Gamma",
    );
    expect(strong).toEqual([
      "Intro.",
      "Across\n1. Alpha\n2. Beta",
      "Down\n3. Gamma",
    ]);

    const table = chunkArticles(
      '<table><tr><td colspan="9"><b>Across</b></td></tr>' +
        "<tr><td>1</td><td>RUMINANT</td></tr></table>" +
        '<table><tr><th colspan="5">Down</th></tr>' +
        "<tr><td>2</td><td>UFO</td></tr></table>",
    );
    expect(table).toEqual(["Across\n1\nRUMINANT", "Down\n2\nUFO"]);
  });

  it("matches section labels case-insensitively without rewriting them", () => {
    const chunks = chunkArticles('<div class="fts-group">aCrOsS</div><p>x</p>');

    expect(chunks[0].split("\n")[0]).toBe("aCrOsS");
  });

  it("separates adjacent block elements so words are not glued together", () => {
    const chunks = chunkArticles("<p>alpha</p><p>beta</p><p>gamma</p>");

    expect(chunks).toEqual(["alpha\nbeta\ngamma"]);
  });

  it("ignores script and style contents", () => {
    const chunks = chunkArticles(
      "<p>visible</p><script>var hidden = 1;</script><style>.x{color:red}</style>" +
        "<h2>Down</h2><p>tail</p>",
    );

    expect(chunks).toEqual(["visible", "Down\ntail"]);
    expect(chunks.join("\n")).not.toContain("hidden");
  });

  it("normalises non-breaking spaces inside clues", () => {
    const chunks = chunkArticles("<p>one&nbsp;&nbsp;two</p>");

    expect(chunks).toEqual(["one two"]);
  });

  it("emits only plain text, never HTML markup", () => {
    const chunks = chunkArticles(
      '<p>Intro <em>with</em> <a href="/x">a link</a>.</p>' +
        '<h2>Across</h2><div class="fts-group">' +
        '<div class="fts-subgroup">1. <strong>BOLD</strong> clue</div></div>',
    );

    expect(chunks.length > 0).toBeTruthy();
    chunks.forEach(assertPlainText);
    expect(chunks.join("\n")).toContain("Intro with a link.");
  });
});
