// Shared HTTP helper for the Fifteensquared ingestion steps.

const USER_AGENT =
  "rag-video-suggester-ingester/0.1 (+https://github.com/joanovalles/rag-video-suggester)";

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GET ${url} failed with ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}
