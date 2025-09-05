import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './drizzle';

async function runMigrations() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'development') {
    // Use custom local migration for PGlite
    const { runLocalMigrations } = await import('./migrate-local');
    await runLocalMigrations();
    return;
  }
  
  console.log(`Running migrations for ${nodeEnv} environment...`);
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (client && typeof client.end === 'function') {
      await client.end();
    }
  }
}

if (require.main === module) {
  runMigrations();
}

export { runMigrations };
