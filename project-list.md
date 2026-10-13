# RAG Video Suggester — High-Level Overview

Recreating WebDevSimplified's "Production Ready RAG AI" project
(https://www.youtube.com/watch?v=1mvlBz6pj1I) as a local-first build.

## Overall

This app is a tool that ingests all WDS videos and blog articles. These
videos/articles are chunked using proper hierarchy and then converted to vector
embeddings via AI for easy lookup. Later the user will search for results and
their search query will be converted to a vector embedding to search our vector
database.

## User Flow

1. User logs in with GitHub so we can properly track/rate limit users to avoid
   abuse and cost issues
2. User searches for a topic they want to learn
3. User chooses a result from the list to view and it opens that result in a new
   page at the location where the topic is covered
4. If user sends too many searches in a specified time they will be rate limited

## UI

- Single page with search bar
- Results show up below search bar with link to go to source material
  - Results have an image, title, description, match %

## Ingestion

The ingestion process will be long running background tasks that utilize the
YouTube API for videos and direct HTML processing for the articles. Articles will
be chunked in proper hierarchy based on headings while videos will be chunked
based on the captions in a sentence by sentence chunking.

Vercel workflows will be used to ensure these ingestion processes are durable and
able to retry on failure.

## Database

We will need to store the content (articles/videos with title, description,
thumbnail, etc.), chunks (with embeddings), user details, rate limit
information, historical search information

---

## Added context (Joan's local-first build)

### Stack
- Next.js + TypeScript + Tailwind (same as video)
- Drizzle ORM + Neon Postgres + pgvector (video's choice; free tier)
- BetterAuth with GitHub provider (the video logs in with GitHub)
- Vercel AI SDK, but models from local Ollama: nomic-embed-text (768-dim
  embeddings), devstral-small-2-24b (generation) via @ai-sdk/openai-compatible
- Ingestion as tsx scripts locally (same step structure as Vercel workflows;
  deployable to Vercel later)
- Secured cron (CRON_SECRET + vercel.json) for periodic re-ingestion
- YouTube Data API v3 (free key) + youtube-transcript package for captions

### Search flow (how a query becomes results)
1. The user's query is embedded with nomic-embed-text into a 768-dim vector
2. pgvector cosine-distance search (`<=>`) over the chunks table returns top-k
3. Match % is derived from the cosine distance; each result shows thumbnail
   image, title, description, match %
4. Clicking a result opens the source at the exact spot: YouTube links carry a
   timestamp (`t=` seconds from the caption chunk), article links carry a heading
   anchor (`#slug`) from the chunk's heading hierarchy

### Chunking strategy
- Articles: split on heading hierarchy (h1/h2/h3), ~1000 chars with 200-char
  overlap on sentence/paragraph boundaries; each chunk records its heading path
  so results can deep-link to the right section
- Videos: sentence-by-sentence chunking over captions; each chunk records
  start/end timestamps so results can deep-link to the right moment
- Embedding dimension must match everywhere (768). Swapping models later means
  re-embedding everything.

### Ingestion pipeline (durable, retryable)
1. Discover: blog sitemap.xml for articles; YouTube Data API for channel videos
2. Fetch: article HTML converted to readable text; video captions via
   youtube-transcript
3. Chunk, embed in batches, upsert into Postgres
4. Idempotent: content hash per source, re-runs skip unchanged content
5. Long-running background workflow with retries; also triggerable on a schedule
   via the secured cron

### Database schema
- sources: id, type ('blog' | 'youtube'), external_id (unique), title,
  description, thumbnail_url, url, published_at, content_hash
- chunks: id, source_id (FK), chunk_index, heading_path / timestamps, content,
  embedding vector(768) with a cosine-distance index
- users + sessions: BetterAuth tables (GitHub OAuth)
- rate_limits: user_id, window_start, count (Postgres-backed token bucket)
- search_history: user_id, query, created_at (the video's "historical search
  information")

### Auth and rate limiting
- GitHub OAuth via BetterAuth; search requires sign-in
- Per-user rate limit (e.g. 20 searches/hour); 429 + Retry-After when exceeded
- Rate limit state lives in Postgres, no extra service

### API surface
- POST /api/search — embed the query, run the vector search, return ranked
  results
- GET /api/cron/ingest — runs ingestion; requires Bearer CRON_SECRET
- /api/auth/[...all] — BetterAuth handlers (GitHub OAuth)

### Scope notes
- The video's app is semantic search over WDS content: search, ranked results,
  deep links. Not a chatbot. A grounded chat UI can be layered on later reusing
  the same chunks as context.
- Content is public WDS material only; no user-uploaded content in v1.
- Cost stays near zero: local embeddings, Neon free tier, YouTube API free quota.
