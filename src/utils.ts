import { Bot } from 'grammy';
import { DrizzleDatabaseService } from './db-drizzle';

// Import types from the types module
import type { Volunteer, Event, Task, TaskAssignment } from './types';

// Escape special characters for Telegram HTML parse_mode
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// Human-friendly date like "18 Sep 2025"
export const formatHumanDate = (dateLike: string | Date): string => {
  const d = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

// Check if volunteer is eligible for promotion
export const checkProbationStatus = (volunteer: Volunteer): {
  isEligible: boolean;
  daysRemaining: number;
  commitmentsNeeded: number;
} => {
  const start = new Date(volunteer.commit_count_start_date);
  const end = volunteer.probation_end_date ? new Date(volunteer.probation_end_date) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const effectiveEnd = end;
  const daysRemaining = Math.max(0, Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const commitmentsNeeded = Math.max(0, 3 - volunteer.commitments);
  
  const isEligible = volunteer.commitments >= 3 && now <= effectiveEnd;
  
  return {
    isEligible,
    daysRemaining,
    commitmentsNeeded
  };
};

// Check if volunteer should be marked as inactive
export const checkInactiveStatus = (volunteer: Volunteer): boolean => {
  const lastUpdate = new Date(volunteer.updated_at);
  const now = new Date();
  const daysSinceUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSinceUpdate > 90; // 3 months
};

// Format volunteer status for display
export const formatVolunteerStatus = (volunteer: Volunteer): string => {
  const { isEligible, daysRemaining, commitmentsNeeded } = checkProbationStatus(volunteer);
  
  const safeName = escapeHtml(volunteer.name);
  const safeHandle = escapeHtml(volunteer.telegram_handle);
  let statusText = `<b>${safeName}</b> (@${safeHandle})\n`;
  statusText += `Status: ${volunteer.status.toUpperCase()}\n`;
  const start = new Date(volunteer.commit_count_start_date);
  const endText = volunteer.probation_end_date ? formatHumanDate(new Date(volunteer.probation_end_date)) : 'present';
  statusText += `Commitments: ${volunteer.commitments} (Tracking: ${formatHumanDate(start)} → ${endText})\n`;
  
  if (volunteer.status === 'probation') {
    if (isEligible) {
      statusText += `🎉 <b>Eligible for promotion to active volunteer!</b>\n`;
    } else {
      statusText += `Probation period: ${daysRemaining} days remaining\n`;
      statusText += `Commitments needed: ${commitmentsNeeded}\n`;
    }
  } else if (volunteer.status === 'inactive') {
    statusText += `⚠️ <b>Status: INACTIVE</b> - Contact an admin to reactivate\n`;
  }
  
  return statusText;
};

// Special handling for TBD event dates
export const TBD_DATE = new Date(Date.UTC(2099, 11, 31, 0, 0, 0)); // 2099-12-31T00:00:00Z
export const TBD_DATE_ISO = TBD_DATE.toISOString();
export const isTbdDateIso = (dateIso: string): boolean => {
  const d = new Date(dateIso);
  return !isNaN(d.getTime()) && d.getTime() === TBD_DATE.getTime();
};

// Format event details for display
export const formatEventDetails = async (event: Event, tasks?: Task[]): Promise<string> => {
  const safeTitle = escapeHtml(event.title);
  let eventText = `<b>${safeTitle}</b>\n`;
  const dateText = isTbdDateIso(event.date) ? 'TBD' : formatHumanDate(event.date);
  eventText += `📅 Date: ${dateText}\n`;
  eventText += `🎯 Format: ${event.format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
  eventText += `📊 Status: ${event.status.replace(/\b\w/g, l => l.toUpperCase())}\n`;
  
  if (event.venue) {
    eventText += `📍 Venue: ${escapeHtml(event.venue)}\n`;
  }
  
  if (event.details) {
    eventText += `📝 Details: ${escapeHtml(event.details)}\n`;
  }
  
  if (tasks && tasks.length > 0) {
    // We'll decide header icon after we compute assignment status

    // Enrich tasks with assignment info, then sort: unassigned first
    const enriched = [] as Array<{
      task: Task;
      assignedTo: string[]; // formatted volunteer mentions
    }>;

    for (const task of tasks) {
      const assignments = await DrizzleDatabaseService.getTaskAssignments(task.id);
      const assignedTo: string[] = [];
      if (assignments.length > 0) {
        for (const assignment of assignments) {
          const allVolunteers = await DrizzleDatabaseService.getAllVolunteers();
          const volunteer = allVolunteers.find(v => v.id === assignment.volunteer_id);
          if (volunteer) {
            const safeName = escapeHtml(volunteer.name);
            const safeHandle = escapeHtml(volunteer.telegram_handle);
            assignedTo.push(`${safeName} (@${safeHandle})`);
          }
        }
      }
      enriched.push({ task, assignedTo });
    }

    enriched.sort((a, b) => (a.assignedTo.length === 0 ? -1 : 1) - (b.assignedTo.length === 0 ? -1 : 1));

    const anyUnassigned = enriched.some(e => e.assignedTo.length === 0);
    eventText += `\n<b>📝 Tasks:</b>\n`;

    for (const item of enriched) {
      const { task, assignedTo } = item;
      const safeTaskTitle = escapeHtml(task.title);
      const assigned = assignedTo.length > 0;
      eventText += `\n• <b>${safeTaskTitle}</b> (ID: <b>${task.id}</b>)\n`;
      eventText += `  Status: ${task.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
      if (assigned) {
        eventText += `  👤 Assigned to: ${assignedTo.join(', ')}\n`;
      } else {
        eventText += `  ⚠️ Open for signup\n`;
      }
      if (task.description) {
        eventText += `  📄 ${escapeHtml(task.description)}\n`;
      }
    }

    eventText += `\n💡 <b>How to volunteer:</b>\n`;
    eventText += `• Use <code>/commit &lt;task_id&gt;</code> to sign up for an available task\n`;
    eventText += `• Example: <code>/commit 5</code> to volunteer for task ID 5\n`;
    eventText += `• Only unassigned tasks are available for signup`;
  } else {
    eventText += `\n📋 No tasks created for this event yet.`;
  }
  
  return eventText;
};

// Send celebration broadcast when volunteer is promoted
export const sendPromotionBroadcast = async (bot: Bot, volunteer: Volunteer): Promise<void> => {
  const groupId = process.env.VOLUNTEER_GROUP_ID;
  
  if (!groupId) {
    console.log('No volunteer channel configured for broadcast');
    return;
  }
  
  const safeName = escapeHtml(volunteer.name);
  const safeHandle = escapeHtml(volunteer.telegram_handle);
  const message = `🎉 <b>Congratulations!</b> 🎉\n\n` +
    `${safeName} (@${safeHandle}) has successfully completed their probation period ` +
    `and is now an <b>active volunteer</b>!\n\n` +
    `They completed ${volunteer.commitments} commitments and are ready to take on more responsibilities. ` +
    `Welcome to the team! 🚀`;
  
  try {
    const options: any = { parse_mode: 'HTML' };
    await bot.api.sendMessage(groupId, message, options);
  } catch (error) {
    console.error('Error sending promotion broadcast:', error);
  }
};

// Validate telegram handle format
export const validateTelegramHandle = (handle: string): string | null => {
  // Remove @ if present and validate format
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanHandle)) {
    return null;
  }
  
  return cleanHandle;
};

// Parse date input (supports various formats)
export const parseDate = (dateInput: string): Date | null => {
  // Try different date formats
  const formats = [
    // ISO format
    /^\d{4}-\d{2}-\d{2}$/,
    // DD/MM/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    // DD-MM-YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/
  ];
  
  let parsedDate: Date;
  
  if (formats[0]?.test(dateInput)) {
    // ISO format
    parsedDate = new Date(dateInput);
  } else if (formats[1]?.test(dateInput) || formats[2]?.test(dateInput)) {
    // DD/MM/YYYY or DD-MM-YYYY
    const separator = dateInput.includes('/') ? '/' : '-';
    const parts = dateInput.split(separator).map(Number);
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    
    if (day === undefined || month === undefined || year === undefined) {
      return null;
    }
    
    parsedDate = new Date(year, month - 1, day);
  } else {
    // Try natural language parsing
    parsedDate = new Date(dateInput);
  }
  
  // Validate the parsed date
  if (isNaN(parsedDate.getTime())) {
    return null;
  }
  
  return parsedDate;
};

// Format task status for display
export const formatTaskStatus = (status: Task['status']): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Check if volunteer can commit to a task
export const canVolunteerCommit = async (volunteerId: number, taskId: number): Promise<{
  canCommit: boolean;
  reason?: string;
}> => {
  // Check if volunteer is already assigned to this task
  const assignments = await DrizzleDatabaseService.getTaskAssignments(taskId);
  const existingAssignment = assignments.find(a => a.volunteer_id === volunteerId);
  
  if (existingAssignment) {
    return {
      canCommit: false,
      reason: 'You are already assigned to this task'
    };
  }
  
  return { canCommit: true };
};

// Auto-promote volunteers who meet criteria
export const checkAndPromoteVolunteers = async (bot: Bot): Promise<void> => {
  const volunteers = await DrizzleDatabaseService.getAllVolunteers();
  
  for (const volunteer of volunteers) {
    if (volunteer.status === 'probation') {
      const { isEligible } = checkProbationStatus(volunteer);
      
      if (isEligible) {
        const success = await DrizzleDatabaseService.updateVolunteerStatus(volunteer.id, 'active');
        if (success) {
          await sendPromotionBroadcast(bot, { ...volunteer, status: 'active' });
        }
      }
    }
  }
};

// Promote a single volunteer if eligible (used on precise triggers)
export const promoteIfEligible = async (bot: Bot, volunteerId: number): Promise<boolean> => {
  const v = await DrizzleDatabaseService.getVolunteerById(volunteerId);
  if (!v) return false;
  if (v.status !== 'probation') return false;
  const { isEligible } = checkProbationStatus(v);
  if (!isEligible) return false;
  const success = await DrizzleDatabaseService.updateVolunteerStatus(v.id, 'active');
  if (success) {
    await sendPromotionBroadcast(bot, { ...v, status: 'active' });
    return true;
  }
  return false;
};

// Mark inactive volunteers based on commitment tracking
// Removed processMonthlyVolunteerStatus and related monthly automation by design


// Filter events to show only today and future events
export const filterFutureEvents = (events: Event[]): Event[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  return events.filter(event => {
    if (isTbdDateIso(event.date)) return true; // Always include TBD events
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0); // Start of event day
    return eventDate >= today;
  });
};
