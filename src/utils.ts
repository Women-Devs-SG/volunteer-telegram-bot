import { Bot } from 'grammy';
import { DrizzleDatabaseService } from './db-drizzle';

// Import types from the types module
import type { Volunteer, Event, Task, TaskAssignment } from './types';

// Escape special characters for Telegram Markdown (v1) parse_mode
// Only escape characters that affect formatting to prevent visible backslashes
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]`])/g, '\\$1');
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
  
  const safeName = escapeMarkdown(volunteer.name);
  const safeHandle = escapeMarkdown(volunteer.telegram_handle);
  let statusText = `**${safeName}** (@${safeHandle})\n`;
  statusText += `Status: ${volunteer.status.toUpperCase()}\n`;
  const start = new Date(volunteer.commit_count_start_date);
  const endText = volunteer.probation_end_date ? new Date(volunteer.probation_end_date).toLocaleDateString() : 'present';
  statusText += `Commitments: ${volunteer.commitments} (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
  
  if (volunteer.status === 'probation') {
    if (isEligible) {
      statusText += `🎉 **Eligible for promotion to active volunteer!**\n`;
    } else {
      statusText += `Probation period: ${daysRemaining} days remaining\n`;
      statusText += `Commitments needed: ${commitmentsNeeded}\n`;
    }
  } else if (volunteer.status === 'inactive') {
    statusText += `⚠️ **Status: INACTIVE** - Contact an admin to reactivate\n`;
  }
  
  return statusText;
};

// Format event details for display
export const formatEventDetails = async (event: Event, tasks?: Task[]): Promise<string> => {
  const safeTitle = escapeMarkdown(event.title);
  let eventText = `**${safeTitle}**\n`;
  eventText += `📅 Date: ${new Date(event.date).toLocaleDateString()}\n`;
  eventText += `🎯 Format: ${event.format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
  eventText += `📊 Status: ${event.status.replace(/\b\w/g, l => l.toUpperCase())}\n`;
  
  if (event.venue) {
    eventText += `📍 Venue: ${escapeMarkdown(event.venue)}\n`;
  }
  
  if (event.details) {
    eventText += `📝 Details: ${escapeMarkdown(event.details)}\n`;
  }
  
  if (tasks && tasks.length > 0) {
    eventText += `\n**📋 Tasks:**\n`;
    
    for (const task of tasks) {
      const statusIcon = task.status === 'complete' ? '✅' : task.status === 'in_progress' ? '🔄' : '❌';
      const safeTaskTitle = escapeMarkdown(task.title);
      eventText += `\n• **${safeTaskTitle}** (ID: **${task.id}**) ${statusIcon}\n`;
      
      // Get task assignments to show who is assigned
      const assignments = await DrizzleDatabaseService.getTaskAssignments(task.id);
      
      if (assignments.length > 0) {
        eventText += `  👤 Assigned to: `;
        const assignedVolunteers = [];
        for (const assignment of assignments) {
          // Get all volunteers and find the one with matching ID
          const allVolunteers = await DrizzleDatabaseService.getAllVolunteers();
          const volunteer = allVolunteers.find(v => v.id === assignment.volunteer_id);
          if (volunteer) {
            const safeName = escapeMarkdown(volunteer.name);
            const safeHandle = escapeMarkdown(volunteer.telegram_handle);
            assignedVolunteers.push(`${safeName} (@${safeHandle})`);
          }
        }
        eventText += assignedVolunteers.join(', ') + '\n';
      } else {
        eventText += `  🔓 **Available for signup**\n`;
      }
      
      if (task.description) {
        eventText += `  📄 ${escapeMarkdown(task.description)}\n`;
      }
    }
    
    eventText += `\n💡 **How to volunteer:**\n`;
    eventText += `• Use \`/commit <task_id>\` to sign up for an available task\n`;
    eventText += `• Example: \`/commit 5\` to volunteer for task ID 5\n`;
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
  
  const safeName = escapeMarkdown(volunteer.name);
  const safeHandle = escapeMarkdown(volunteer.telegram_handle);
  const message = `🎉 **Congratulations!** 🎉\n\n` +
    `${safeName} (@${safeHandle}) has successfully completed their probation period ` +
    `and is now an **active volunteer**!\n\n` +
    `They completed ${volunteer.commitments} commitments and are ready to take on more responsibilities. ` +
    `Welcome to the team! 🚀`;
  
  try {
    const options: any = { parse_mode: 'Markdown' };
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
export const processMonthlyVolunteerStatus = async (bot: Bot): Promise<string> => {
  try {
    // Update volunteer statuses based on commitments
    const { updated, inactive } = await DrizzleDatabaseService.updateVolunteerStatusBasedOnCommitments();
    
    // Reset commitments for the new month
    await DrizzleDatabaseService.resetMonthlyCommitments();
    
    // Generate status report
    const report = await DrizzleDatabaseService.getVolunteerStatusReport();
    
    let message = `📊 **Monthly Volunteer Status Report**\n\n`;
    message += `**Status Updates:**\n`;
    message += `• ${updated} volunteers had status changes\n`;
    message += `• ${inactive} volunteers marked as inactive\n\n`;
    
    message += `**Current Volunteer Breakdown:**\n`;
    message += `👥 **Total Volunteers:** ${report.total}\n\n`;
    
    if (report.lead.length > 0) {
      message += `🌟 **Lead Volunteers (${report.lead.length}):**\n`;
      report.lead.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle})\n`;
      });
      message += `\n`;
    }
    
    if (report.active.length > 0) {
      message += `✅ **Active Volunteers (${report.active.length}):**\n`;
      report.active.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments\n`;
      });
      message += `\n`;
    }
    
    if (report.probation.length > 0) {
      message += `🔄 **Probation Volunteers (${report.probation.length}):**\n`;
      report.probation.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments\n`;
      });
      message += `\n`;
    }
    
    if (report.inactive.length > 0) {
      message += `⚠️ **Inactive Volunteers (${report.inactive.length}):**\n`;
      report.inactive.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments\n`;
      });
      message += `\n`;
    }
    
    message += `**Next Steps:**\n`;
    message += `• Probation volunteers need 3 commitments to become active\n`;
    message += `• Inactive volunteers should be contacted for reactivation\n`;
    message += `• Commitment counters have been reset for the new month\n`;
    
    return message;
  } catch (error) {
    console.error('Error processing monthly volunteer status:', error);
    return 'Error generating monthly volunteer status report.';
  }
};


// Filter events to show only today and future events
export const filterFutureEvents = (events: Event[]): Event[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  return events.filter(event => {
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0); // Start of event day
    return eventDate >= today;
  });
};
