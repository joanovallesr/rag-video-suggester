import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { serverEnv } from './src/data/serverEnv';

export default defineConfig({
  out: './src/db/migrations',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: serverEnv.DATABASE_URL!,
  },
});
