# Production Database Migration Guide

This guide covers safe database migration practices for the Telegram Volunteer Bot in production environments.

## Migration Workflow

### 1. Development Phase

```bash
# Make schema changes in src/schema.ts
# Generate migration files
npm run db:generate

# Test locally with development database
npm run setup:local
npm test
```

### 2. Pre-Production Testing

```bash
# Create a staging database with production data copy
# Test migration on staging environment
npm run migration:test-staging

# Or run steps individually:
npm run db:backup:staging
npm run db:migrate:staging
npm run db:studio:staging
```

### 3. Production Deployment

```bash
# Safe production deployment (backup + migrate)
npm run migration:safe-deploy

# Or run steps individually:
# 1. Backup production database
npm run db:backup:prod

# 2. Run migration during maintenance window
npm run db:migrate:prod

# 3. Verify migration success
npm run db:studio:prod
npm run db:introspect
```

## Migration Types & Strategies

### Safe Migrations (No Downtime)
- Adding new tables
- Adding new columns (with defaults)
- Adding indexes (with CONCURRENTLY)
- Creating new enums

```sql
-- Example: Adding a new column
ALTER TABLE volunteers ADD COLUMN phone_number TEXT;
```

### Breaking Migrations (Require Downtime)
- Dropping columns
- Renaming columns
- Changing column types
- Dropping tables

```sql
-- Example: Renaming a column (requires app update)
ALTER TABLE volunteers RENAME COLUMN telegram_handle TO telegram_username;
```

### Multi-Step Migrations
For breaking changes, use a multi-step approach:

**Step 1: Add new column**
```sql
ALTER TABLE volunteers ADD COLUMN telegram_username TEXT;
```

**Step 2: Populate new column (in application code)**
```typescript
// Update application to write to both columns
await db.update(volunteers)
  .set({ 
    telegram_handle: handle,
    telegram_username: handle  // New column
  });
```

**Step 3: Switch reads to new column**
```typescript
// Update queries to use new column
const volunteer = await db.select()
  .from(volunteers)
  .where(eq(volunteers.telegram_username, username));
```

**Step 4: Drop old column**
```sql
ALTER TABLE volunteers DROP COLUMN telegram_handle;
```

## Database Backup Strategies

### Automated Backups
Set up automated backups in your hosting provider:

**Supabase**: Automatic daily backups included
**Neon**: Point-in-time recovery available
**Railway**: Manual backup via dashboard
**Self-hosted**: Use cron jobs with pg_dump

### Manual Backup Before Migration
```bash
# Full database backup (using environment variables)
npm run db:backup:prod

# Or manually with specific URLs:
pg_dump $PRODUCTION_DATABASE_URL > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Schema-only backup
pg_dump --schema-only $PRODUCTION_DATABASE_URL > schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Data-only backup
pg_dump --data-only $PRODUCTION_DATABASE_URL > data_backup_$(date +%Y%m%d_%H%M%S).sql
```

## Rollback Procedures

### Immediate Rollback
If migration fails:

```bash
# 1. Stop the application
# 2. Restore from backup
psql $PRODUCTION_DATABASE_URL < backup_pre_migration_YYYYMMDD_HHMMSS.sql

# 3. Revert application code
git revert <migration-commit>

# 4. Restart application
```

### Partial Rollback
For multi-step migrations:

```bash
# Generate reverse migration
npm run db:generate

# Apply reverse migration to production
npm run db:migrate:prod
```

## Monitoring & Verification

### Post-Migration Checks

```bash
# 1. Verify schema matches expected state
npm run db:introspect

# 2. Check data integrity
npm run db:studio

# 3. Run application tests
npm test

# 4. Monitor application logs
tail -f /var/log/telegram-bot.log

# 5. Test critical bot commands
# /start, /admin_volunteers, /list_events
```

### Health Checks
```typescript
// Add to your bot startup
async function verifyDatabaseHealth() {
  try {
    const volunteerCount = await db.select({ count: count() }).from(volunteers);
    const eventCount = await db.select({ count: count() }).from(events);
    
    console.log(`Database health check: ${volunteerCount[0].count} volunteers, ${eventCount[0].count} events`);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
```

## Common Migration Scenarios

### Adding New Event Format
```sql
-- 1. Add new enum value (safe)
ALTER TYPE event_format ADD VALUE 'hackathon';

-- 2. Update application code to handle new format
-- 3. No downtime required
```

### Adding Volunteer Metadata
```sql
-- 1. Add new columns with defaults
ALTER TABLE volunteers ADD COLUMN skills TEXT[] DEFAULT '{}';
ALTER TABLE volunteers ADD COLUMN availability TEXT DEFAULT 'weekends';

-- 2. Update application gradually
-- 3. Populate data over time
```

### Restructuring Task System
```sql
-- Multi-step approach required:
-- 1. Create new tables
-- 2. Migrate data gradually
-- 3. Update application code
-- 4. Remove old tables
```

## Emergency Procedures

### Database Connection Issues
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1;"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"
```

### Migration Stuck
```bash
# Check migration status
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"

# Check for locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"

# Force unlock (use with extreme caution)
psql $DATABASE_URL -c "SELECT pg_advisory_unlock_all();"
```

## Best Practices Summary

1. **Always backup before migrations**
2. **Test on staging environment first**
3. **Use maintenance windows for breaking changes**
4. **Monitor application after deployment**
5. **Have rollback plan ready**
6. **Document all migration steps**
7. **Use feature flags for gradual rollouts**
8. **Keep migrations small and focused**
9. **Review generated SQL before applying**
10. **Coordinate with team on breaking changes**

## Tools & Resources

- **Drizzle Studio**: Visual database management
- **pg_dump/pg_restore**: PostgreSQL backup tools
- **Database monitoring**: Set up alerts for connection issues
- **Application monitoring**: Track bot command success rates
- **Staging environment**: Mirror production for testing

## Getting Help

If you encounter issues during migration:

1. Check Drizzle documentation: https://orm.drizzle.team/
2. Review PostgreSQL logs
3. Use Drizzle Studio to inspect database state
4. Create an issue in the repository with migration details
5. Contact the team in emergency situations
