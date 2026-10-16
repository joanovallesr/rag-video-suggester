import { describe, expect, it } from "vitest";
import { extractArticle } from "./extract";

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

describe("post body selection", () => {
  it("prefers .entry-content inside <article>", () => {
    const { contentHtml } = extractArticle(
      '<!doctype html><html><body><div class="entry-content">OUTSIDE</div>' +
        '<article><div class="entry-content">INSIDE</div></article></body></html>',
      BASE_URL,
    );

    expect(contentHtml).toBe("INSIDE");
  });

  it("falls back to .entry-content when there is no <article>", () => {
    const { contentHtml } = extractArticle(
      '<!doctype html><html><body><div class="entry-content">' +
        "<h2>Across</h2><p>only entry</p></div></body></html>",
      BASE_URL,
    );

    expect(contentHtml).toBe("<h2>Across</h2><p>only entry</p>");
  });

  it("falls back to <article> when there is no .entry-content", () => {
    const { contentHtml } = extractArticle(
      '<!doctype html><html><body><article><h2>Down</h2><p>article only</p></article></body></html>',
      BASE_URL,
    );

    expect(contentHtml).toBe("<h2>Down</h2><p>article only</p>");
  });

  it("removes the WordPress #more anchor from the stored HTML", () => {
    const { contentHtml } = extract(
      '<p>Before more.</p><p><span id="more-123"></span></p><h2>Across</h2><p>1.</p>',
    );

    expect(contentHtml).not.toContain("more-123");
    expect(contentHtml).toContain("<h2>Across</h2>");
  });
});

describe("thumbnailUrl", () => {
  it("prefers the og:image meta tag and resolves relative URLs", () => {
    const { thumbnailUrl } = extract(
      "<p>body</p>",
      '<meta property="og:image" content="/wp-content/uploads/grid.png">',
    );

    expect(thumbnailUrl).toBe(
      "https://fifteensquared.net/wp-content/uploads/grid.png",
    );
  });

  it("falls back to the first image in the post body", () => {
    const { thumbnailUrl } = extract(
      '<p>intro</p><img src="https://cdn.example.com/first.png" alt="grid">',
    );

    expect(thumbnailUrl).toBe("https://cdn.example.com/first.png");
  });

  it("uses a lazy-loaded data-src when src is absent", () => {
    const { thumbnailUrl } = extract(
      '<img data-src="https://cdn.example.com/lazy.png">',
    );

    expect(thumbnailUrl).toBe("https://cdn.example.com/lazy.png");
  });

  it("ignores data: URIs and keeps looking for a usable image", () => {
    const { thumbnailUrl } = extract(
      '<img src="data:image/gif;base64,R0lGOD" data-src="https://cdn.example.com/real.png">',
    );

    expect(thumbnailUrl).toBe("https://cdn.example.com/real.png");
  });

  it("returns null when the article has no usable image", () => {
    const { thumbnailUrl } = extract("<p>no images here</p>");

    expect(thumbnailUrl).toBe(null);
  });
});
