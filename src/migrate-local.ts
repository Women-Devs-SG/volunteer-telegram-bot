import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from './drizzle';

async function runLocalMigrations() {
  console.log('Running local migrations for PGlite...');
  
  try {
    // Create migrations table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    // Get list of migration files
    const migrationsDir = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Check if migration already applied
      const existing = await db.execute(
        `SELECT id FROM "__drizzle_migrations" WHERE hash = '${file}'`
      );
      
      // Also check if tables actually exist
      let tablesExist = false;
      try {
        await db.execute(`SELECT 1 FROM "admins" LIMIT 1`);
        tablesExist = true;
      } catch (error) {
        // Tables don't exist
      }
      
      if (existing.rows.length > 0 && tablesExist) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      } else if (existing.rows.length > 0 && !tablesExist) {
        console.log(`🔄 Re-applying ${file} (migration recorded but tables missing)`);
        // Clear the migration record to force re-application
        await db.execute(`DELETE FROM "__drizzle_migrations" WHERE hash = '${file}'`);
      }

      console.log(`🔄 Applying ${file}...`);

      // Split SQL content by Drizzle statement breakpoints and semicolons
      const commands = content
        .split(/--> statement-breakpoint|;/)
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.includes('statement-breakpoint'));

      for (const command of commands) {
        if (command.trim()) {
          try {
            await db.execute(command);
          } catch (error: any) {
            // Handle "already exists" errors gracefully
            if (error.cause?.code === '42710' || // type already exists
                error.cause?.code === '42P07' || // relation already exists
                error.cause?.code === '42710') { // duplicate object
              console.log(`⚠️  Skipping command (already exists): ${command.substring(0, 50)}...`);
              continue;
            }
            console.error(`Error executing command: ${command}`);
            throw error;
          }
        }
      }

      // Record migration as applied
      await db.execute(
        `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('${file}', ${Date.now()})`
      );

      console.log(`✅ Applied ${file}`);
    }

    console.log('✅ Local migrations completed successfully!');
  } catch (error) {
    console.error('❌ Local migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runLocalMigrations();
}

export { runLocalMigrations };
