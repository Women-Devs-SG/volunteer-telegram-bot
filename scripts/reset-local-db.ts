import { rmSync, existsSync } from 'fs';
import { join } from 'path';

async function resetLocalDatabase() {
  console.log('🗑️  Resetting local database...');
  
  try {
    const localDbPath = join(process.cwd(), 'local-db');
    
    if (existsSync(localDbPath)) {
      rmSync(localDbPath, { recursive: true, force: true });
      console.log('✅ Deleted existing local database');
    } else {
      console.log('ℹ️  No existing local database found');
    }
    
    console.log('🎉 Local database reset complete!');
    console.log('💡 Run "npm run setup:local" to create a fresh database');
    
  } catch (error) {
    console.error('❌ Error resetting local database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  resetLocalDatabase();
}

export { resetLocalDatabase };
