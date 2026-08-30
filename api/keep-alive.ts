import dotenv from 'dotenv';
dotenv.config();

import { DrizzleDatabaseService } from '../src/db-drizzle';

// Vercel Cron target (see vercel.staging.json / vercel.production.json "crons").
// Performs a single read-only DB query so the Supabase free-tier project
// counts as active and isn't auto-paused after 7 days without activity.
// Intentionally not registered in src/bot.ts / api/webhook.ts — it isn't a
// bot command, so the command-parity check does not apply to this file.
export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers?.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
  }

  try {
    const isAlive = await DrizzleDatabaseService.pingDatabase();
    if (!isAlive) {
      console.error('Keep-alive ping failed: database reported unreachable');
      res.status(500).json({ ok: false, error: 'Database ping failed' });
      return;
    }

    res.status(200).json({
      ok: true,
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Keep-alive ping error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
