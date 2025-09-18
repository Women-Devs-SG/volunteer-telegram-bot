import { db } from '../src/drizzle';
import { events } from '../src/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function updateEventDates() {
  console.log('📅 Updating event dates to future dates...');

  try {
    // Update each event to have a future date
    await db.update(events)
      .set({ date: new Date('2025-01-15T18:00:00Z') })
      .where(eq(events.id, 1));

    await db.update(events)
      .set({ date: new Date('2025-02-02T19:00:00Z') })
      .where(eq(events.id, 2));

    await db.update(events)
      .set({ date: new Date('2025-01-28T17:30:00Z') })
      .where(eq(events.id, 3));

    await db.update(events)
      .set({ date: new Date('2025-01-30T20:00:00Z') })
      .where(eq(events.id, 4));

    await db.update(events)
      .set({ date: new Date('2025-03-15T09:00:00Z') })
      .where(eq(events.id, 5));

    console.log('✅ Event dates updated successfully!');
  } catch (error) {
    console.error('❌ Error updating event dates:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  updateEventDates().then(() => {
    console.log('🎉 Event date update completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Update failed:', error);
    process.exit(1);
  });
}

export { updateEventDates };
