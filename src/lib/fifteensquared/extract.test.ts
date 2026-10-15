import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanChunk, extractArticle } from "./extract";

const BASE_URL = "https://fifteensquared.net/2026/10/14/example/";

/** Wrap post-body markup in a minimal single-post page. */
function articlePage(bodyHtml: string, headHtml = ""): string {
  return [
    "<!doctype html><html>",
    `<head>${headHtml}</head>`,
    "<body>",
    '<article class="post type-post">',
    '<div class="entry-content" itemprop="text">',
    bodyHtml,
    "</div>",
    "</article>",
    "</body></html>",
  ].join("");
}

function extract(bodyHtml: string, headHtml = "", url = BASE_URL) {
  return extractArticle(articlePage(bodyHtml, headHtml), url);
}

/** A chunk must never leak HTML markup. */
function assertPlainText(chunk: string) {
  assert.ok(!/[<>]/.test(chunk), `chunk contains markup: ${JSON.stringify(chunk)}`);
}

describe("cleanChunk", () => {
  it("collapses runs of spaces and non-breaking spaces", () => {
    assert.equal(cleanChunk("  one \u00a0  two  "), "one two");
  });

  it("collapses blank lines but keeps single line breaks", () => {
    assert.equal(cleanChunk("alpha\n\n\n beta  \n gamma"), "alpha\nbeta\ngamma");
  });

  it("trims surrounding whitespace and returns empty for blank input", () => {
    assert.equal(cleanChunk("   \n\t "), "");
  });
});

describe("chunking post bodies", () => {
  it("splits on <h2> and keeps the heading as the first line", () => {
    const { chunks } = extract(
      "<p>Intro paragraph.</p>" +
        "<h2>Across</h2><p>1. First clue.</p>" +
        "<h2>Down</h2><p>2. Second clue.</p>",
    );

    assert.deepEqual(chunks, [
      "Intro paragraph.",
      "Across\n1. First clue.",
      "Down\n2. Second clue.",
    ]);
  });

  it("saves all text before the first heading as its own chunk", () => {
    const { chunks } = extract(
      "<p>Preamble one.</p><p>Preamble two.</p>" +
        "<h2>Across</h2><p>1. Clue.</p>",
    );

    assert.equal(chunks.length, 2);
    assert.equal(chunks[0], "Preamble one.\nPreamble two.");
  });

  it("omits the intro chunk when the body starts with a heading", () => {
    const { chunks } = extract("<h2>Across</h2><p>1. Clue.</p>");

    assert.deepEqual(chunks, ["Across\n1. Clue."]);
  });

  it("returns a single chunk when there are no headings", () => {
    const { chunks } = extract("<p>Only intro text.</p><p>Second paragraph.</p>");

    assert.deepEqual(chunks, ["Only intro text.\nSecond paragraph."]);
  });

  it("splits on headings of any level (h1-h6)", () => {
    const { chunks } = extract("<h3>Across</h3><p>a</p><h4>Down</h4><p>b</p>");

    assert.deepEqual(chunks, ["Across\na", "Down\nb"]);
  });

  it("recognises real-world Across/Down markers used by the blog", () => {
    // The blog does not use <h2> for section titles. Nested clue wrappers
    // (`div.fts-group` holding a whole clue) must NOT be treated as headings.
    const { chunks } = extract(
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

    assert.deepEqual(chunks, [
      "Blog intro.",
      "ACROSS\n1. Clue one\nANSWER",
      "DOWN\n2. Clue two",
    ]);
  });

  it("recognises <strong>/<b> and table-cell markers", () => {
    const strong = extract(
      "<p>Intro.</p><strong>Across</strong><br />1. Alpha<br />2. Beta<br />" +
        "<strong>Down</strong><br />3. Gamma",
    );
    assert.deepEqual(strong.chunks, [
      "Intro.",
      "Across\n1. Alpha\n2. Beta",
      "Down\n3. Gamma",
    ]);

    const table = extract(
      '<table><tr><td colspan="9"><b>Across</b></td></tr>' +
        "<tr><td>1</td><td>RUMINANT</td></tr></table>" +
        '<table><tr><th colspan="5">Down</th></tr>' +
        "<tr><td>2</td><td>UFO</td></tr></table>",
    );
    assert.deepEqual(table.chunks, ["Across\n1\nRUMINANT", "Down\n2\nUFO"]);
  });

  it("matches section labels case-insensitively without rewriting them", () => {
    const { chunks } = extract('<div class="fts-group">aCrOsS</div><p>x</p>');

    assert.equal(chunks[0].split("\n")[0], "aCrOsS");
  });

  it("separates adjacent block elements so words are not glued together", () => {
    const { chunks } = extract("<p>alpha</p><p>beta</p><p>gamma</p>");

    assert.deepEqual(chunks, ["alpha\nbeta\ngamma"]);
  });

  it("ignores script and style contents", () => {
    const { chunks } = extract(
      "<p>visible</p><script>var hidden = 1;</script><style>.x{color:red}</style>" +
        "<h2>Down</h2><p>tail</p>",
    );

    assert.deepEqual(chunks, ["visible", "Down\ntail"]);
    assert.ok(!chunks.join("\n").includes("hidden"));
  });

  it("normalises non-breaking spaces inside clues", () => {
    const { chunks } = extract("<p>one&nbsp;&nbsp;two</p>");

    assert.deepEqual(chunks, ["one two"]);
  });

  it("emits only plain text, never HTML markup", () => {
    const { chunks } = extract(
      '<p>Intro <em>with</em> <a href="/x">a link</a>.</p>' +
        '<h2>Across</h2><div class="fts-group">' +
        '<div class="fts-subgroup">1. <strong>BOLD</strong> clue</div></div>',
    );

    assert.ok(chunks.length > 0);
    chunks.forEach(assertPlainText);
    assert.ok(chunks.join("\n").includes("Intro with a link."));
  });
});

describe("post body selection", () => {
  it("prefers .entry-content inside <article>", () => {
    const { contentHtml, chunks } = extractArticle(
      '<!doctype html><html><body><div class="entry-content">OUTSIDE</div>' +
        '<article><div class="entry-content">INSIDE</div></article></body></html>',
      BASE_URL,
    );

    assert.deepEqual(chunks, ["INSIDE"]);
    assert.equal(contentHtml, "INSIDE");
  });

  it("falls back to .entry-content when there is no <article>", () => {
    const { chunks } = extractArticle(
      '<!doctype html><html><body><div class="entry-content">' +
        "<h2>Across</h2><p>only entry</p></div></body></html>",
      BASE_URL,
    );

    assert.deepEqual(chunks, ["Across\nonly entry"]);
  });

  it("falls back to <article> when there is no .entry-content", () => {
    const { chunks } = extractArticle(
      '<!doctype html><html><body><article><h2>Down</h2><p>article only</p></article></body></html>',
      BASE_URL,
    );

    assert.deepEqual(chunks, ["Down\narticle only"]);
  });

  it("removes the WordPress #more anchor from the stored HTML", () => {
    const { contentHtml } = extract(
      '<p>Before more.</p><p><span id="more-123"></span></p><h2>Across</h2><p>1.</p>',
    );

    assert.ok(!contentHtml.includes("more-123"));
    assert.ok(contentHtml.includes("<h2>Across</h2>"));
  });
});

describe("thumbnailUrl", () => {
  it("prefers the og:image meta tag and resolves relative URLs", () => {
    const { thumbnailUrl } = extract(
      "<p>body</p>",
      '<meta property="og:image" content="/wp-content/uploads/grid.png">',
    );

    assert.equal(
      thumbnailUrl,
      "https://fifteensquared.net/wp-content/uploads/grid.png",
    );
  });

  it("falls back to the first image in the post body", () => {
    const { thumbnailUrl } = extract(
      '<p>intro</p><img src="https://cdn.example.com/first.png" alt="grid">',
    );

    assert.equal(thumbnailUrl, "https://cdn.example.com/first.png");
  });

  it("uses a lazy-loaded data-src when src is absent", () => {
    const { thumbnailUrl } = extract(
      '<img data-src="https://cdn.example.com/lazy.png">',
    );

    assert.equal(thumbnailUrl, "https://cdn.example.com/lazy.png");
  });

  it("ignores data: URIs and keeps looking for a usable image", () => {
    const { thumbnailUrl } = extract(
      '<img src="data:image/gif;base64,R0lGOD" data-src="https://cdn.example.com/real.png">',
    );

    assert.equal(thumbnailUrl, "https://cdn.example.com/real.png");
  });

  it("returns null when the article has no usable image", () => {
    const { thumbnailUrl } = extract("<p>no images here</p>");

    assert.equal(thumbnailUrl, null);
  });
});
