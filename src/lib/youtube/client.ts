import { google, type youtube_v3 } from "googleapis";
import { serverEnv } from "../../data/serverEnv";

/** YouTube Data API client authenticated with a public-data API key. */
export function getYouTubeClient(): youtube_v3.Youtube {
  return google.youtube({ version: "v3", auth: serverEnv.YOUTUBE_API_KEY });
}
