import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./decodeEntities";

describe("decodeHtmlEntities", () => {
  it("decodes the numeric entities found in RSS descriptions", () => {
    expect(
      decodeHtmlEntities(
        "It wouldn&#8217;t be a true puzzle&#8230; &#8220;quoted&#8221;",
      ),
    ).toBe("It wouldn’t be a true puzzle… “quoted”");
  });

  it("decodes hexadecimal entities", () => {
    expect(decodeHtmlEntities("It&#x2019;s here")).toBe("It’s here");
  });

  it("folds non-breaking and other spaces into regular spaces", () => {
    expect(decodeHtmlEntities("S&#38;B&#160;York")).toBe("S&B York");
  });

  it("decodes common named entities", () => {
    expect(
      decodeHtmlEntities("&amp; &lt; &gt; &quot; &apos; &mdash; &hellip;"),
    ).toBe("& < > \" ' — …");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeHtmlEntities("&notarealentity; &bogus;")).toBe(
      "&notarealentity; &bogus;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(decodeHtmlEntities("No entities here.")).toBe("No entities here.");
  });

  it("does not double-decode", () => {
    expect(decodeHtmlEntities("&amp;#8217;")).toBe("&#8217;");
  });

  it("ignores invalid code points", () => {
    expect(decodeHtmlEntities("&#0; &#xD800; &#x110000;")).toBe(
      "&#0; &#xD800; &#x110000;",
    );
  });

  it("decodes entities embedded in surrounding prose", () => {
    expect(
      decodeHtmlEntities("Monk&#8217;s puzzle &#8211; great fun"),
    ).toBe("Monk’s puzzle – great fun");
  });
});
