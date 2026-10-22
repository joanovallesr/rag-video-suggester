import type { youtube_v3 } from "googleapis";
import type { DiscoveryResult, SkippedVideo, VideoCandidate } from "./types";
import { classifyVideo, getPlaylistItemVideoId } from "./video";

export const CHANNEL_HANDLE = "@crackingthecryptic";
export const MAX_VIDEOS_PER_RUN = 50;
export const MAX_PAGES = 10;

const PAGE_SIZE = 50;

/**
 * Resolve the channel's uploads playlist. `UU...` is the uploads counterpart
 * of the channel's `UC...` id, but the API is the source of truth.
 */
export async function fetchUploadsPlaylistId(
  youtube: youtube_v3.Youtube,
): Promise<string> {
  const response = await youtube.channels.list({
    part: ["contentDetails"],
    forHandle: CHANNEL_HANDLE,
  });

  const playlistId =
    response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!playlistId) {
    throw new Error(`Could not resolve the uploads playlist for ${CHANNEL_HANDLE}`);
  }

  return playlistId;
}

async function fetchPlaylistPage(
  youtube: youtube_v3.Youtube,
  playlistId: string,
  pageToken: string | undefined,
) {
  const response = await youtube.playlistItems.list({
    part: ["snippet", "contentDetails"],
    playlistId,
    maxResults: PAGE_SIZE,
    pageToken,
  });

  return {
    items: response.data.items ?? [],
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/**
 * Fetch durations and live status for a page of uploads. One call covers up to
 * 50 videos and costs one quota unit.
 */
export async function fetchVideoDetails(
  youtube: youtube_v3.Youtube,
  videoIds: string[],
): Promise<Map<string, youtube_v3.Schema$Video>> {
  const details = new Map<string, youtube_v3.Schema$Video>();
  if (videoIds.length === 0) return details;

  const response = await youtube.videos.list({
    part: ["snippet", "contentDetails", "liveStreamingDetails"],
    id: videoIds,
    maxResults: PAGE_SIZE,
  });

  for (const video of response.data.items ?? []) {
    if (video.id) details.set(video.id, video);
  }

  return details;
}

/**
 * Walk the uploads playlist until `MAX_VIDEOS_PER_RUN` new videos are found,
 * a known video is reached, or `MAX_PAGES` is exhausted.
 */
export async function discoverUploads(
  youtube: youtube_v3.Youtube,
  knownVideoIds: ReadonlySet<string>,
): Promise<DiscoveryResult> {
  const playlistId = await fetchUploadsPlaylistId(youtube);

  const candidates: VideoCandidate[] = [];
  const skipped: SkippedVideo[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { items, nextPageToken } = await fetchPlaylistPage(
      youtube,
      playlistId,
      pageToken,
    );
    if (items.length === 0) break;

    const ids = items
      .map(getPlaylistItemVideoId)
      .filter((id): id is string => id !== null);
    const details = await fetchVideoDetails(youtube, ids);

    let stop = false;
    for (const item of items) {
      const videoId = getPlaylistItemVideoId(item);
      if (!videoId) continue;

      if (knownVideoIds.has(videoId)) {
        stop = true;
        break;
      }

      const classification = classifyVideo(item, details.get(videoId));
      if (classification.status === "ignore") continue;
      if (classification.status === "skip") {
        skipped.push({ videoId, reason: classification.reason });
        continue;
      }

      candidates.push(classification.video);
      if (candidates.length >= MAX_VIDEOS_PER_RUN) {
        stop = true;
        break;
      }
    }

    if (stop || !nextPageToken) break;
    pageToken = nextPageToken;
  }

  return { candidates, skipped };
}
