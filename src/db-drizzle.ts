import { eq, and, ne } from 'drizzle-orm';
import { db } from './drizzle';
import { volunteers, events, tasks, taskAssignments, admins } from './schema';
import type { NewVolunteer, NewEvent, NewTask, NewTaskAssignment } from './schema';

// Updated types for new schema
interface Volunteer {
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

interface Event {
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

interface Task {
  id: number;
  event_id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'complete';
  created_at: string;
  updated_at: string;
}

interface TaskAssignment {
  id: number;
  task_id: number;
  volunteer_id: number;
  assigned_by?: number | null;
  assigned_at: string;
}

// Helper function to convert dates
function toISOString(date: Date | null): string {
  return date ? date.toISOString() : new Date().toISOString();
}

export class DrizzleDatabaseService {
  // Volunteer operations
  static async getVolunteerByHandle(telegramHandle: string): Promise<Volunteer | null> {
    try {
      const result = await db.select()
        .from(volunteers)
        .where(eq(volunteers.telegram_handle, telegramHandle))
        .limit(1);
      
      if (!result[0]) return null;
      
      const volunteer = result[0];
      return {
        ...volunteer,
        commit_count_start_date: toISOString((volunteer as any).commit_count_start_date),
        probation_end_date: (volunteer as any).probation_end_date ? toISOString((volunteer as any).probation_end_date) : null,
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      };
    } catch (error) {
      console.error('Error fetching volunteer:', error);
      return null;
    }
  } // Added closing brace here

  // Delete an event by ID (tasks will cascade-delete via FK on tasks.event_id)
  static async deleteEvent(id: number): Promise<boolean> {
    try {
      await db.delete(events).where(eq(events.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  // Delete a task by ID (assignments are removed via ON CASCADE)
  static async deleteTask(taskId: number): Promise<boolean> {
    try {
      await db.delete(tasks).where(eq(tasks.id, taskId));
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }

  // Update event partial fields (title, date, format, venue, details)
  static async updateEventFields(id: number, fields: Partial<{
    title: string;
    date: string; // ISO string
    format: Event['format'];
    venue: string | null;
    details: string | undefined;
  }>): Promise<boolean> {
    try {
      const updatePayload: any = { updated_at: new Date() };
      if (typeof fields.title !== 'undefined') updatePayload.title = fields.title;
      if (typeof fields.date !== 'undefined') updatePayload.date = new Date(fields.date);
      if (typeof fields.format !== 'undefined') updatePayload.format = fields.format;
      if (typeof fields.venue !== 'undefined') updatePayload.venue = fields.venue;
      if (typeof fields.details !== 'undefined') updatePayload.details = fields.details;

      await db.update(events)
        .set(updatePayload)
        .where(eq(events.id, id));
      return true;
    } catch (error) {
      console.error('Error updating event fields:', error);
      return false;
    }
  }

  // Get a volunteer by numeric ID
  static async getVolunteerById(id: number): Promise<Volunteer | null> {
    try {
      const result = await db.select()
        .from(volunteers)
        .where(eq(volunteers.id, id))
        .limit(1);

      if (!result[0]) return null;

      const volunteer = result[0];
      return {
        ...volunteer,
        commit_count_start_date: toISOString((volunteer as any).commit_count_start_date),
        probation_end_date: (volunteer as any).probation_end_date ? toISOString((volunteer as any).probation_end_date) : null,
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      };
    } catch (error) {
      console.error('Error fetching volunteer by id:', error);
      return null;
    }
  }

  static async createVolunteer(name: string, telegramHandle: string, status: Volunteer['status'] = 'probation'): Promise<Volunteer | null> {
    try {
      const newVolunteer: NewVolunteer = {
        name,
        telegram_handle: telegramHandle,
        status,
        commitments: 0,
        commit_count_start_date: new Date(),
        probation_end_date: null,
      };

      const result = await db.insert(volunteers)
        .values(newVolunteer)
        .returning();

      if (!result[0]) return null;
      
      const volunteer = result[0];
      return {
        ...volunteer,
        commit_count_start_date: toISOString((volunteer as any).commit_count_start_date),
        probation_end_date: (volunteer as any).probation_end_date ? toISOString((volunteer as any).probation_end_date) : null,
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      };
    } catch (error) {
      console.error('Error creating volunteer:', error);
      return null;
    }
  }

  static async updateVolunteerStatus(id: number, status: Volunteer['status']): Promise<boolean> {
    try {
      await db.update(volunteers)
        .set({ status, updated_at: new Date() })
        .where(eq(volunteers.id, id));

      return true;
    } catch (error) {
      console.error('Error updating volunteer status:', error);
      return false;
    }
  }

  static async setVolunteerCommitments(id: number, commitments: number): Promise<boolean> {
    try {
      await db.update(volunteers)
        .set({ 
          commitments,
          updated_at: new Date()
        })
        .where(eq(volunteers.id, id));

      return true;
    } catch (error) {
      console.error('Error setting volunteer commitments:', error);
      return false;
    }
  }

  static async incrementVolunteerCommitments(id: number): Promise<boolean> {
    try {
      const volunteer = await this.getVolunteerById(id);
      if (!volunteer) return false;
      const next = (volunteer.commitments ?? 0) + 1;
      return await this.setVolunteerCommitments(id, next);
    } catch (error) {
      console.error('Error incrementing volunteer commitments:', error);
      return false;
    }
  }

  static async getAllVolunteers(): Promise<Volunteer[]> {
    try {
      const result = await db.select()
        .from(volunteers)
        .orderBy(volunteers.created_at);

      return result.map((volunteer: typeof volunteers.$inferSelect) => ({
        ...volunteer,
        commit_count_start_date: toISOString((volunteer as any).commit_count_start_date),
        probation_end_date: (volunteer as any).probation_end_date ? toISOString((volunteer as any).probation_end_date) : null,
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching volunteers:', error);
      return [];
    }
  }

  static async removeVolunteer(telegramHandle: string): Promise<boolean> {
    try {
      await db.delete(volunteers)
        .where(eq(volunteers.telegram_handle, telegramHandle));

      return true;
    } catch (error) {
      console.error('Error removing volunteer:', error);
      return false;
    }
  }

  // Event operations
  static async createEvent(title: string, date: string, format: Event['format'], details?: string, venue?: string, createdBy?: number): Promise<Event | null> {
    try {
      const newEvent: NewEvent = {
        title,
        date: new Date(date),
        format,
        details,
        venue,
        created_by: createdBy,
        status: 'planning'
      };

      const result = await db.insert(events)
        .values(newEvent)
        .returning();

      if (!result[0]) return null;
      
      const event = result[0];
      return {
        ...event,
        date: toISOString(event.date),
        details: event.details || undefined,
        created_at: toISOString(event.created_at),
        updated_at: toISOString(event.updated_at),
      };
    } catch (error) {
      console.error('Error creating event:', error);
      return null;
    }
  }

  static async getEvent(id: number): Promise<Event | null> {
    try {
      const result = await db.select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);

      if (!result[0]) return null;
      
      const event = result[0];
      return {
        ...event,
        date: toISOString(event.date),
        details: event.details || undefined,
        created_at: toISOString(event.created_at),
        updated_at: toISOString(event.updated_at),
      };
    } catch (error) {
      console.error('Error fetching event:', error);
      return null;
    }
  }

  static async updateEventStatus(id: number, status: Event['status']): Promise<boolean> {
    try {
      await db.update(events)
        .set({ status, updated_at: new Date() })
        .where(eq(events.id, id));

      // If event is marked completed, cascade: complete tasks and increment commitments
      if (status === 'completed') {
        // Fetch tasks for this event
        const eventTasks = await this.getEventTasks(id);
        for (const task of eventTasks) {
          if (task.status !== 'complete') {
            await this.updateTaskStatus(task.id, 'complete');
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating event status:', error);
      return false;
    }
  }

  // Helper: increment commitments and promote if now >= 3 and status probation/inactive
  static async incrementCommitmentsAndMaybePromote(volunteerId: number): Promise<void> {
    try {
      const v = await this.getVolunteerById(volunteerId);
      if (!v) return;
      // Increment first
      await this.incrementVolunteerCommitments(volunteerId);
      const nextCommitments = (v.commitments ?? 0) + 1;
      // Promote if threshold met and status is probation or inactive
      if (nextCommitments >= 3 && (v.status === 'probation' || v.status === 'inactive')) {
        await this.updateVolunteerStatus(volunteerId, 'active');
      }
    } catch (e) {
      console.error('Error incrementing commitments and maybe promoting:', e);
    }
  }

  static async getAllUpcomingEvents(): Promise<Event[]> {
    try {
      const result = await db.select()
        .from(events)
        .where(and(
          ne(events.status, 'completed'),
          ne(events.status, 'cancelled')
        ))
        .orderBy(events.created_at);

      return result.map((event: typeof events.$inferSelect) => ({
        ...event,
        date: toISOString(event.date),
        venue: event.venue,
        details: event.details || undefined,
        created_by: event.created_by,
        created_at: toISOString(event.created_at),
        updated_at: toISOString(event.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching all events:', error);
      return [];
    }
  }

  // Task operations
  static async createTask(eventId: number, title: string, description?: string): Promise<Task | null> {
    try {
      const newTask: NewTask = {
        event_id: eventId,
        title,
        description,
        status: 'todo'
      };

      const result = await db.insert(tasks)
        .values(newTask)
        .returning();

      if (!result[0]) return null;
      
      const task = result[0];
      return {
        ...task,
        event_id: task.event_id || 0,
        description: task.description || undefined,
        created_at: toISOString(task.created_at),
        updated_at: toISOString(task.updated_at),
      };
    } catch (error) {
      console.error('Error creating task:', error);
      return null;
    }
  }

  static async assignVolunteerToTask(taskId: number, volunteerId: number, assignedBy?: number): Promise<boolean> {
    try {
      const newAssignment: NewTaskAssignment = {
        task_id: taskId,
        volunteer_id: volunteerId,
        assigned_by: assignedBy
      };

      await db.insert(taskAssignments)
        .values(newAssignment);

      return true;
    } catch (error) {
      console.error('Error assigning volunteer to task:', error);
      return false;
    }
  }

  static async removeVolunteerFromTask(taskId: number, volunteerId: number): Promise<boolean> {
    try {
      await db.delete(taskAssignments)
        .where(and(
          eq(taskAssignments.task_id, taskId),
          eq(taskAssignments.volunteer_id, volunteerId)
        ));
      return true;
    } catch (error) {
      console.error('Error removing volunteer from task:', error);
      return false;
    }
  }

  static async getEventTasks(eventId: number): Promise<Task[]> {
    try {
      const result = await db.select()
        .from(tasks)
        .where(eq(tasks.event_id, eventId));

      return result.map((task: typeof tasks.$inferSelect) => ({
        id: task.id || 0,
        event_id: task.event_id || 0,
        title: task.title || '',
        description: task.description || undefined,
        status: task.status || 'todo',
        created_at: toISOString(task.created_at),
        updated_at: toISOString(task.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching event tasks:', error);
      return [];
    }
  }

  // Get a single task by ID
  static async getTask(taskId: number): Promise<Task | null> {
    try {
      const result = await db.select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      const task = result[0];
      if (!task) return null;

      return {
        id: task.id || 0,
        event_id: task.event_id || 0,
        title: task.title || '',
        description: task.description || undefined,
        status: task.status || 'todo',
        created_at: toISOString(task.created_at),
        updated_at: toISOString(task.updated_at),
      };
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  }

  static async updateTaskStatus(taskId: number, status: 'todo' | 'in_progress' | 'complete'): Promise<boolean> {
    try {
      // Fetch current status to detect transitions to complete
      const existing = await this.getTask(taskId);
      await db.update(tasks)
        .set({ 
          status,
          updated_at: new Date()
        })
        .where(eq(tasks.id, taskId));

      // On transition to complete, update commitments and maybe promote
      if (status === 'complete' && existing && existing.status !== 'complete') {
        const assignments = await this.getTaskAssignments(taskId);
        for (const assignment of assignments) {
          await this.incrementCommitmentsAndMaybePromote(assignment.volunteer_id);
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating task status:', error);
      return false;
    }
  }

  static async createVolunteerWithStatus(name: string, telegramHandle: string, status: 'probation' | 'active' | 'lead' | 'inactive'): Promise<Volunteer | null> {
    try {
      const result = await db.insert(volunteers).values({
        name,
        telegram_handle: telegramHandle,
        status,
        commit_count_start_date: new Date(),
        commitments: 0,
        created_at: new Date(),
        updated_at: new Date(),
        probation_end_date: null,
      }).returning();

      const volunteer = result[0];
      if (!volunteer) return null;

      return {
        id: volunteer.id || 0,
        name: volunteer.name || '',
        telegram_handle: volunteer.telegram_handle || '',
        status: volunteer.status || 'probation',
        commit_count_start_date: toISOString((volunteer as any).commit_count_start_date),
        probation_end_date: (volunteer as any).probation_end_date ? toISOString((volunteer as any).probation_end_date) : null,
        commitments: volunteer.commitments || 0,
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      };
    } catch (error) {
      console.error('Error creating volunteer with status:', error);
      return null;
    }
  }

  // Reset all volunteer commitments for a new quarter and set tracking period
  static async resetQuarterCommitments(endDate: Date): Promise<{ success: boolean; inactivated: Array<{ id: number; name: string; telegram_handle: string }> }> {
    try {
      const nextStart = new Date(endDate);
      nextStart.setDate(nextStart.getDate() + 1);

      // Fetch current volunteers with their pre-reset commitments & status
      const all = await db.select().from(volunteers);

      const inactivated: Array<{ id: number; name: string; telegram_handle: string }> = [];

      // Update each volunteer: reset commitments and dates; set inactive only if pre-reset commitments were 0 and status probation/active
      for (const v of all) {
        const shouldInactivate = (v.commitments || 0) === 0 && (v.status === 'probation' || v.status === 'active');
        await db.update(volunteers)
          .set({
            commitments: 0,
            probation_end_date: endDate,
            commit_count_start_date: nextStart,
            updated_at: new Date(),
            ...(shouldInactivate ? { status: 'inactive' as const } : {}),
          })
          .where(eq(volunteers.id, v.id));

        if (shouldInactivate) {
          inactivated.push({ id: v.id, name: (v as any).name, telegram_handle: (v as any).telegram_handle });
        }
      }

      return { success: true, inactivated };
    } catch (error) {
      console.error('Error resetting quarter commitments:', error);
      return { success: false, inactivated: [] };
    }
  }

  // ... (rest of the code remains the same)
  static async getTaskAssignments(taskId: number): Promise<TaskAssignment[]> {
    try {
      const result = await db.select()
        .from(taskAssignments)
        .where(eq(taskAssignments.task_id, taskId));

      return result.map((assignment: any) => ({
        ...assignment,
        task_id: assignment.task_id || 0,
        volunteer_id: assignment.volunteer_id || 0,
        assigned_at: toISOString(assignment.assigned_at),
      }));
    } catch (error) {
      console.error('Error fetching task assignments:', error);
      return [];
    }
  }

  static async getVolunteerTasks(volunteerId: number): Promise<Task[]> {
    try {
      const result = await db.select({
        id: tasks.id,
        event_id: tasks.event_id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        created_at: tasks.created_at,
        updated_at: tasks.updated_at,
      })
        .from(tasks)
        .innerJoin(taskAssignments, eq(tasks.id, taskAssignments.task_id))
        .where(eq(taskAssignments.volunteer_id, volunteerId))
        .orderBy(tasks.created_at);

      return result.map((task: any) => ({
        ...task,
        event_id: task.event_id || 0,
        description: task.description || undefined,
        created_at: toISOString(task.created_at),
        updated_at: toISOString(task.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching volunteer tasks:', error);
      return [];
    }
  }

  // Admin operations
  static async isAdmin(telegramHandle: string): Promise<boolean> {
    try {
      const result = await db.select({ id: admins.id })
        .from(admins)
        .where(eq(admins.telegram_handle, telegramHandle))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  static async addAdmin(telegramHandle: string, role: string = 'admin'): Promise<boolean> {
    try {
      await db.insert(admins)
        .values({
          telegram_handle: telegramHandle,
          role
        });

      return true;
    } catch (error) {
      console.error('Error adding admin:', error);
      return false;
    }
  }

  static async removeAdmin(telegramHandle: string): Promise<boolean> {
    try {
      await db.delete(admins)
        .where(eq(admins.telegram_handle, telegramHandle));

      return true;
    } catch (error) {
      console.error('Error removing admin:', error);
      return false;
    }
  }

  // Commitment tracking and status management
  static async resetMonthlyCommitments(): Promise<boolean> {
    try {
      await db.update(volunteers)
        .set({ 
          commitments: 0,
          updated_at: new Date()
        });
      
      return true;
    } catch (error) {
      console.error('Error resetting monthly commitments:', error);
      return false;
    }
  }

  static async updateVolunteerStatusBasedOnCommitments(): Promise<{ updated: number; inactive: number }> {
    try {
      // Get all volunteers with their current status and commitments
      const allVolunteers = await db.select()
        .from(volunteers);
      
      let updatedCount = 0;
      let inactiveCount = 0;
      
      for (const volunteer of allVolunteers) {
        const commitments = volunteer.commitments || 0;
        const currentStatus = volunteer.status;
        
        // Check if volunteer should be marked inactive
        if (commitments < 3 && (currentStatus === 'probation' || currentStatus === 'active')) {
          await db.update(volunteers)
            .set({ 
              status: 'inactive',
              updated_at: new Date()
            })
            .where(eq(volunteers.id, volunteer.id));
          
          updatedCount++;
          inactiveCount++;
        }
        // Check if probation volunteer should be promoted to active
        else if (commitments >= 3 && currentStatus === 'probation') {
          await db.update(volunteers)
            .set({ 
              status: 'active',
              updated_at: new Date()
            })
            .where(eq(volunteers.id, volunteer.id));
          
          updatedCount++;
        }
      }
      
      return { updated: updatedCount, inactive: inactiveCount };
    } catch (error) {
      console.error('Error updating volunteer status based on commitments:', error);
      return { updated: 0, inactive: 0 };
    }
  }

  static async getVolunteerStatusReport(): Promise<{
    probation: Volunteer[];
    active: Volunteer[];
    lead: Volunteer[];
    inactive: Volunteer[];
    total: number;
  }> {
    try {
      const allVolunteers = await this.getAllVolunteers();
      
      const report = {
        probation: allVolunteers.filter(v => v.status === 'probation'),
        active: allVolunteers.filter(v => v.status === 'active'),
        lead: allVolunteers.filter(v => v.status === 'lead'),
        inactive: allVolunteers.filter(v => v.status === 'inactive'),
        total: allVolunteers.length
      };
      
      return report;
    } catch (error) {
      console.error('Error generating volunteer status report:', error);
      return {
        probation: [],
        active: [],
        lead: [],
        inactive: [],
        total: 0
      };
    }
  }
}
