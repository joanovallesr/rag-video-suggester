// Shared types for the Fifteensquared ingestion workflow. Kept free of runtime
// dependencies so they can be imported from the workflow function itself.

// A single post discovered in the Fifteensquared RSS feed.
export type ArticleRef = {
  url: string;
  title: string;
  description: string;
  // ISO date only (YYYY-MM-DD), matching the `content.publishDate` DATE column.
  publishDate: string;
};

// The result of parsing one article's HTML.
export type ExtractedArticle = {
  // Raw HTML of the post body (the `.entry-content` container).
  contentHtml: string;
  thumbnailUrl: string | null;
};
