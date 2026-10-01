import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sql, eq } from 'drizzle-orm';
import { db } from '../src/drizzle';
import { volunteers } from '../src/schema';

describe('Migration 0004 — cumulative_commitments backfill', () => {
  it('backfills cumulative_commitments from existing commitments for pre-existing rows', async () => {
    // Simulate the pre-migration schema: volunteers row without cumulative_commitments,
    // as would exist in production before this migration runs.
    await db.execute(sql`ALTER TABLE volunteers DROP COLUMN cumulative_commitments`);

    await db.execute(sql`
      INSERT INTO volunteers (name, telegram_handle, commitments)
      VALUES ('Legacy Volunteer', '@legacyvolunteer', 6)
    `);
    await db.execute(sql`
      INSERT INTO volunteers (name, telegram_handle, commitments)
      VALUES ('Fresh Volunteer', '@freshvolunteer', 0)
    `);

    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../drizzle/0004_many_the_fallen.sql'),
      'utf8'
    );
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }

    const [legacy] = await db.select().from(volunteers).where(eq(volunteers.telegram_handle, '@legacyvolunteer'));
    const [fresh] = await db.select().from(volunteers).where(eq(volunteers.telegram_handle, '@freshvolunteer'));

    expect(legacy.commitments).toBe(6);
    expect(legacy.cumulative_commitments).toBe(6);
    expect(fresh.commitments).toBe(0);
    expect(fresh.cumulative_commitments).toBe(0);
  });
});
