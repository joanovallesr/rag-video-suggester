import { openai } from "@ai-sdk/openai";

const OPENAI_MODEL = "text-embedding-3-small";

export function getEmbeddingModel() {
  return openai.embedding(OPENAI_MODEL);
}
