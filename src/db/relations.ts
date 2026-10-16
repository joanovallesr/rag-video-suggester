import { defineRelations, defineRelationsPart } from "drizzle-orm";
import * as schema from "./schema";
import { content } from "./schemas/content";
import { chunk } from "./schemas/chunks";

export const relations = defineRelations(schema)

export const contentRelations = defineRelationsPart({ content, chunk }, (r) => ({
  content: {
    chunks: r.many.chunk({
      from: r.content.id,
      to: r.chunk.contentId,
    }),
  },
  chunk: {
    content: r.one.content({
      from: r.chunk.contentId,
      to: r.content.id,
    }),
  },
}));
