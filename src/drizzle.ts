import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Get environment mode
const nodeEnv = process.env.NODE_ENV || 'development';

let db: any;
let client: any;

if (nodeEnv === 'development') {
  // Use PGlite for local development - inline setup
  const dbDir = path.join(process.cwd(), 'local-db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Create PGlite instance for local development
  client = new PGlite(path.join(dbDir, 'volunteer-bot.db'));
  
  // Create drizzle instance with PGlite
  db = drizzle(client, { schema });
} else {
  // Use PostgreSQL for staging/production
  const { drizzle: drizzlePg } = require('drizzle-orm/postgres-js');
  const postgres = require('postgres');
  
  let connectionString;
  
  if (nodeEnv === 'staging') {
    connectionString = process.env.STAGING_DATABASE_URL;
  } else {
    connectionString = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  }
  
  if (!connectionString) {
    throw new Error(`Database URL environment variable is required for ${nodeEnv} environment`);
  }
  
  // Create postgres client
  const pgClient = postgres(connectionString);
  
  // Create drizzle instance
  db = drizzlePg(pgClient, { schema });
  client = pgClient;
}

export { db, client };
