import { eq, and } from 'drizzle-orm';
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
  probation_start_date: string;
  created_at: string;
  updated_at: string;
}

interface Event {
  id: number;
  title: string;
  date: string;
  format: 'moderated_discussion' | 'conference' | 'talk' | 'hangout' | 'meeting' | 
          'external_speaker' | 'newsletter' | 'social_media_takeover' | 'workshop' | 'panel' | 'others';
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
        probation_start_date: toISOString(volunteer.probation_start_date),
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      };
    } catch (error) {
      console.error('Error fetching volunteer:', error);
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
        probation_start_date: new Date(),
      };

      const result = await db.insert(volunteers)
        .values(newVolunteer)
        .returning();

      if (!result[0]) return null;
      
      const volunteer = result[0];
      return {
        ...volunteer,
        probation_start_date: toISOString(volunteer.probation_start_date),
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

  static async incrementVolunteerCommitments(id: number): Promise<boolean> {
    try {
      const volunteer = await db.select({ commitments: volunteers.commitments })
        .from(volunteers)
        .where(eq(volunteers.id, id))
        .limit(1);

      if (volunteer.length === 0) {
        return false;
      }

      const currentCommitments = volunteer[0]?.commitments ?? 0;
      await db.update(volunteers)
        .set({ 
          commitments: currentCommitments + 1,
          updated_at: new Date()
        })
        .where(eq(volunteers.id, id));

      return true;
    } catch (error) {
      console.error('Error incrementing commitments:', error);
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
        probation_start_date: toISOString(volunteer.probation_start_date),
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

      return true;
    } catch (error) {
      console.error('Error updating event status:', error);
      return false;
    }
  }

  static async getAllEvents(): Promise<Event[]> {
    try {
      const result = await db.select()
        .from(events)
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
      await db.update(tasks)
        .set({ 
          status,
          updated_at: new Date()
        })
        .where(eq(tasks.id, taskId));
      
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
        probation_start_date: status === 'probation' ? new Date() : null,
        commitments: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning();

      const volunteer = result[0];
      if (!volunteer) return null;

      return {
        id: volunteer.id || 0,
        name: volunteer.name || '',
        telegram_handle: volunteer.telegram_handle || '',
        status: volunteer.status || 'probation',
        probation_start_date: toISOString(volunteer.probation_start_date),
        commitments: volunteer.commitments || 0,
        created_at: toISOString(volunteer.created_at),
        updated_at: toISOString(volunteer.updated_at),
      };
    } catch (error) {
      console.error('Error creating volunteer with status:', error);
      return null;
    }
  }

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
