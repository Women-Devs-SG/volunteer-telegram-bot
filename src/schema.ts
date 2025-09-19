import { pgTable, serial, text, integer, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const volunteerStatusEnum = pgEnum('volunteer_status', ['probation', 'active', 'lead', 'inactive']);
export const eventFormatEnum = pgEnum('event_format', [
  'moderated_discussion',
  'conference', 
  'talk',
  'hangout',
  'meeting',
  'external_speaker',
  'newsletter',
  'social_media_campaign',
  'coding_project',
  'workshop',
  'panel',
  'others'
]);
export const eventStatusEnum = pgEnum('event_status', ['planning', 'published', 'completed', 'cancelled']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'complete']);

// Volunteers table
export const volunteers = pgTable('volunteers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  telegram_handle: text('telegram_handle').notNull().unique(),
  status: volunteerStatusEnum('status').notNull().default('probation'),
  commitments: integer('commitments').notNull().default(0),
  commit_count_start_date: timestamp('commit_count_start_date', { withTimezone: true }).defaultNow(),
  probation_end_date: timestamp('probation_end_date', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  telegramHandleIdx: index('idx_volunteers_telegram_handle').on(table.telegram_handle),
  statusIdx: index('idx_volunteers_status').on(table.status),
}));

// Events table
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  format: eventFormatEnum('format').notNull(),
  status: eventStatusEnum('status').notNull().default('planning'),
  venue: text('venue'),
  details: text('details'),
  created_by: integer('created_by').references(() => volunteers.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  dateIdx: index('idx_events_date').on(table.date),
  statusIdx: index('idx_events_status').on(table.status),
  createdByIdx: index('idx_events_created_by').on(table.created_by),
}));

// Tasks table (replaces event roles)
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  event_id: integer('event_id').references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('todo'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  eventIdIdx: index('idx_tasks_event_id').on(table.event_id),
  statusIdx: index('idx_tasks_status').on(table.status),
}));

// Task assignments table (many-to-many relationship)
export const taskAssignments = pgTable('task_assignments', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  volunteer_id: integer('volunteer_id').references(() => volunteers.id, { onDelete: 'cascade' }),
  assigned_by: integer('assigned_by').references(() => volunteers.id, { onDelete: 'set null' }),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  taskIdIdx: index('idx_task_assignments_task_id').on(table.task_id),
  volunteerIdIdx: index('idx_task_assignments_volunteer_id').on(table.volunteer_id),
}));

// Admins table
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  telegram_handle: text('telegram_handle').notNull().unique(),
  role: text('role').notNull().default('admin'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  telegramHandleIdx: index('idx_admins_telegram_handle').on(table.telegram_handle),
}));

// Define relations
export const volunteersRelations = relations(volunteers, ({ many }) => ({
  createdEvents: many(events),
}));

export const eventsRelations = relations(events, ({ many, one }) => ({
  tasks: many(tasks),
  creator: one(volunteers, {
    fields: [events.created_by],
    references: [volunteers.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  event: one(events, {
    fields: [tasks.event_id],
    references: [events.id],
  }),
  assignments: many(taskAssignments),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.task_id],
    references: [tasks.id],
  }),
  volunteer: one(volunteers, {
    fields: [taskAssignments.volunteer_id],
    references: [volunteers.id],
  }),
  assignedBy: one(volunteers, {
    fields: [taskAssignments.assigned_by],
    references: [volunteers.id],
  }),
}));

// Export types
export type Volunteer = typeof volunteers.$inferSelect;
export type NewVolunteer = typeof volunteers.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type NewTaskAssignment = typeof taskAssignments.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
