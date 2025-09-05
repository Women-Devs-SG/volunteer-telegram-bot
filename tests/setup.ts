import { beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../src/drizzle';
import { volunteers, events, tasks, taskAssignments, admins } from '../src/schema';
import { sql } from 'drizzle-orm';

// Set NODE_ENV to development for tests to use PGlite
process.env.NODE_ENV = 'development';

beforeAll(async () => {
  console.log('Setting up test environment...');
  
  // Create enums and tables directly without migrations
  try {
    // Create enums if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE volunteer_status AS ENUM('probation', 'active', 'lead', 'inactive');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE event_format AS ENUM('moderated_discussion', 'conference', 'talk', 'hangout', 'meeting', 'external_speaker', 'newsletter', 'social_media_takeover', 'workshop', 'panel', 'others');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE event_status AS ENUM('planning', 'published', 'completed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE task_status AS ENUM('todo', 'in_progress', 'complete');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Create tables using raw SQL to avoid migration issues
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS volunteers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        telegram_handle TEXT NOT NULL UNIQUE,
        status volunteer_status NOT NULL DEFAULT 'probation',
        commitments INTEGER NOT NULL DEFAULT 0,
        probation_start_date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        date TIMESTAMPTZ NOT NULL,
        format event_format NOT NULL,
        status event_status NOT NULL DEFAULT 'planning',
        venue TEXT,
        details TEXT,
        created_by INTEGER REFERENCES volunteers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status task_status NOT NULL DEFAULT 'todo',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        volunteer_id INTEGER REFERENCES volunteers(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES volunteers(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        telegram_handle TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
  } catch (error) {
    console.log('Note: Some database objects may already exist');
  }
});

beforeEach(async () => {
  // Clean up database before each test
  try {
    await db.delete(taskAssignments);
    await db.delete(tasks);
    await db.delete(events);
    await db.delete(volunteers);
    await db.delete(admins);
  } catch (error) {
    // Tables might not exist yet, ignore errors
    console.log('Note: Some tables may not exist yet during cleanup');
  }
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
});
