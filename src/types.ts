// Type adapters for compatibility between Drizzle and existing code
import type { Volunteer as DrizzleVolunteer, Event as DrizzleEvent, Task as DrizzleTask, TaskAssignment as DrizzleTaskAssignment } from './schema';

// Updated types for new schema
export interface Volunteer {
  id: number;
  name: string;
  telegram_handle: string;
  status: 'probation' | 'active' | 'lead' | 'inactive';
  commitments: number;
  commit_count_start_date: string;
  probation_end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: number;
  title: string;
  date: string;
  format: 'moderated_discussion' | 'conference' | 'talk' | 'hangout' | 'meeting' | 
          'external_speaker' | 'newsletter' | 'social_media_campaign' | 'coding_project' | 'workshop' | 'panel' | 'others';
  status: 'planning' | 'published' | 'completed' | 'cancelled';
  venue?: string | null;
  details?: string;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  event_id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'complete';
  created_at: string;
  updated_at: string;
}

export interface TaskAssignment {
  id: number;
  task_id: number;
  volunteer_id: number;
  assigned_by?: number | null;
  assigned_at: string;
}

// Type converters
export function convertDrizzleVolunteer(drizzleVolunteer: DrizzleVolunteer): Volunteer {
  return {
    ...drizzleVolunteer,
    commit_count_start_date: (drizzleVolunteer as any).commit_count_start_date?.toISOString() || new Date().toISOString(),
    probation_end_date: (drizzleVolunteer as any).probation_end_date?.toISOString?.() || (drizzleVolunteer as any).probation_end_date || null,
    created_at: drizzleVolunteer.created_at?.toISOString() || new Date().toISOString(),
    updated_at: drizzleVolunteer.updated_at?.toISOString() || new Date().toISOString(),
  };
}

export function convertDrizzleEvent(drizzleEvent: DrizzleEvent): Event {
  return {
    ...drizzleEvent,
    venue: drizzleEvent.venue,
    details: drizzleEvent.details || undefined,
    created_by: drizzleEvent.created_by,
    date: drizzleEvent.date?.toISOString() || new Date().toISOString(),
    created_at: drizzleEvent.created_at?.toISOString() || new Date().toISOString(),
    updated_at: drizzleEvent.updated_at?.toISOString() || new Date().toISOString(),
  };
}

export function convertDrizzleTask(drizzleTask: DrizzleTask): Task {
  return {
    ...drizzleTask,
    event_id: drizzleTask.event_id || 0,
    description: drizzleTask.description || undefined,
    created_at: drizzleTask.created_at?.toISOString() || new Date().toISOString(),
    updated_at: drizzleTask.updated_at?.toISOString() || new Date().toISOString(),
  };
}

export function convertDrizzleTaskAssignment(drizzleTaskAssignment: DrizzleTaskAssignment): TaskAssignment {
  return {
    ...drizzleTaskAssignment,
    task_id: drizzleTaskAssignment.task_id || 0,
    volunteer_id: drizzleTaskAssignment.volunteer_id || 0,
    assigned_at: drizzleTaskAssignment.assigned_at?.toISOString() || new Date().toISOString(),
  };
}
