import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  ...(isDevelopment 
    ? {
        driver: 'pglite',
        dbCredentials: {
          url: './local-db/volunteer-bot.db'
        }
      }
    : {
        dbCredentials: {
          url: process.env.DATABASE_URL || ''
        }
      }
  ),
});
