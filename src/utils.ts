import { Bot } from 'grammy';
import { DrizzleDatabaseService } from './db-drizzle';
import { parseTopicLink } from './parse-topic-link';

// Import types from the types module
import type { Volunteer, Event, Task, TaskAssignment } from './types';

// Task templates based on event format
export const getRequiredTasks = (format: Event['format']): { title: string; description: string }[] => {
  const baseTasks = [
    { title: 'Pre-event Marketing', description: 'Promote the event before it happens' },
    { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event' }
  ];
  
  switch (format) {
    case 'panel':
      return [
        ...baseTasks,
        { title: 'Moderation', description: 'Moderate the panel discussion' },
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' },
        { title: 'Speaker Confirmation', description: 'Confirm speakers and their topics' }
      ];
    case 'workshop':
      return [
        ...baseTasks,
        { title: 'Facilitation', description: 'Facilitate the workshop activities' },
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' }
      ];
    case 'conference':
    case 'talk':
    case 'external_speaker':
      return [
        ...baseTasks,
        { title: 'Speaker Coordination', description: 'Coordinate with speakers and manage logistics' },
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' }
      ];
    case 'meeting':
    case 'hangout':
      return [
        ...baseTasks,
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' }
      ];
    case 'moderated_discussion':
      return [
        ...baseTasks,
        { title: 'Moderation', description: 'Moderate the discussion' },
        { title: 'Topic Preparation', description: 'Prepare discussion topics and questions' }
      ];
    case 'newsletter':
      return [
        { title: 'Content Creation', description: 'Create newsletter content' },
        { title: 'Review and Editing', description: 'Review and edit the newsletter before publishing' }
      ];
    case 'social_media_takeover':
      return [
        { title: 'Content Planning', description: 'Plan social media content for the takeover' },
        { title: 'Content Creation', description: 'Create posts, stories, and other content' }
      ];
    default:
      return baseTasks;
  }
};

// Check if volunteer is eligible for promotion
export const checkProbationStatus = (volunteer: Volunteer): {
  isEligible: boolean;
  daysRemaining: number;
  commitmentsNeeded: number;
} => {
  const probationStart = new Date(volunteer.probation_start_date);
  const now = new Date();
  const daysSinceProbation = Math.floor((now.getTime() - probationStart.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 90 - daysSinceProbation); // 3 months = 90 days
  const commitmentsNeeded = Math.max(0, 3 - volunteer.commitments);
  
  const isEligible = volunteer.commitments >= 3 && daysSinceProbation <= 90;
  
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
  
  let statusText = `**${volunteer.name}** (@${volunteer.telegram_handle})\n`;
  statusText += `Status: ${volunteer.status.toUpperCase()}\n`;
  statusText += `Commitments: ${volunteer.commitments}\n`;
  
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
  let eventText = `**${event.title}**\n`;
  eventText += `📅 Date: ${new Date(event.date).toLocaleDateString()}\n`;
  eventText += `🎯 Format: ${event.format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
  eventText += `📊 Status: ${event.status.replace(/\b\w/g, l => l.toUpperCase())}\n`;
  
  if (event.venue) {
    eventText += `📍 Venue: ${event.venue}\n`;
  }
  
  if (event.details) {
    eventText += `📝 Details: ${event.details}\n`;
  }
  
  if (tasks && tasks.length > 0) {
    eventText += `\n**📋 Tasks:**\n`;
    
    for (const task of tasks) {
      const statusIcon = task.status === 'complete' ? '✅' : task.status === 'in_progress' ? '🔄' : '❌';
      eventText += `\n• **${task.title}** (ID: **${task.id}**) ${statusIcon}\n`;
      
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
            assignedVolunteers.push(`${volunteer.name} (@${volunteer.telegram_handle})`);
          }
        }
        eventText += assignedVolunteers.join(', ') + '\n';
      } else {
        eventText += `  🔓 **Available for signup**\n`;
      }
      
      if (task.description) {
        eventText += `  📄 ${task.description}\n`;
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
  let channelId = process.env.VOLUNTEER_CHANNEL_ID;
  let topicId = process.env.VOLUNTEER_TOPIC_ID;
  
  // Check if topic link is provided instead
  const topicLink = process.env.VOLUNTEER_TOPIC_LINK;
  if (topicLink && !channelId) {
    const parsed = parseTopicLink(topicLink);
    if (parsed) {
      channelId = parsed.channelId;
      topicId = parsed.topicId;
    }
  }
  
  if (!channelId) {
    console.log('No volunteer channel configured for broadcast');
    return;
  }
  
  const message = `🎉 **Congratulations!** 🎉\n\n` +
    `${volunteer.name} (@${volunteer.telegram_handle}) has successfully completed their probation period ` +
    `and is now an **active volunteer**!\n\n` +
    `They completed ${volunteer.commitments} commitments and are ready to take on more responsibilities. ` +
    `Welcome to the team! 🚀`;
  
  try {
    const options: any = { parse_mode: 'Markdown' };
    
    // If topic ID is provided, send to specific topic in forum channel
    if (topicId) {
      options.message_thread_id = parseInt(topicId);
    }
    
    await bot.api.sendMessage(channelId, message, options);
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
        message += `• ${v.name} (@${v.telegram_handle})\n`;
      });
      message += `\n`;
    }
    
    if (report.active.length > 0) {
      message += `✅ **Active Volunteers (${report.active.length}):**\n`;
      report.active.forEach(v => {
        message += `• ${v.name} (@${v.telegram_handle}) - ${v.commitments} commitments\n`;
      });
      message += `\n`;
    }
    
    if (report.probation.length > 0) {
      message += `🔄 **Probation Volunteers (${report.probation.length}):**\n`;
      report.probation.forEach(v => {
        message += `• ${v.name} (@${v.telegram_handle}) - ${v.commitments} commitments\n`;
      });
      message += `\n`;
    }
    
    if (report.inactive.length > 0) {
      message += `⚠️ **Inactive Volunteers (${report.inactive.length}):**\n`;
      report.inactive.forEach(v => {
        message += `• ${v.name} (@${v.telegram_handle}) - ${v.commitments} commitments\n`;
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

// Get all available task templates for selection
export const getAllTaskTemplates = (): { title: string; description: string; category: string }[] => {
  return [
    // Marketing tasks
    { title: 'Pre-event Marketing', description: 'Promote the event before it happens', category: 'Marketing' },
    { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event', category: 'Marketing' },
    { title: 'Social Media Promotion', description: 'Create and share social media content', category: 'Marketing' },
    { title: 'Newsletter Announcement', description: 'Include event in newsletter', category: 'Marketing' },
    
    // Coordination tasks
    { title: 'Date Confirmation', description: 'Confirm the event date with all participants', category: 'Coordination' },
    { title: 'Speaker Confirmation', description: 'Confirm speakers and their topics', category: 'Coordination' },
    { title: 'Speaker Coordination', description: 'Coordinate with speakers and manage logistics', category: 'Coordination' },
    { title: 'Venue Coordination', description: 'Coordinate venue logistics and setup', category: 'Coordination' },
    
    // Event Management
    { title: 'Moderation', description: 'Moderate the panel discussion or event', category: 'Event Management' },
    { title: 'Facilitation', description: 'Facilitate the workshop activities or discussion', category: 'Event Management' },
    { title: 'Topic Preparation', description: 'Prepare discussion topics and questions', category: 'Event Management' },
    { title: 'Technical Setup', description: 'Handle technical equipment and setup', category: 'Event Management' },
    
    // Content Creation
    { title: 'Content Creation', description: 'Create content for the event or publication', category: 'Content' },
    { title: 'Content Planning', description: 'Plan content structure and topics', category: 'Content' },
    { title: 'Review and Editing', description: 'Review and edit content before publishing', category: 'Content' },
    
    // General
    { title: 'Registration Management', description: 'Manage event registrations and attendee list', category: 'General' },
    { title: 'Follow-up Communications', description: 'Send follow-up messages to attendees', category: 'General' },
    { title: 'Documentation', description: 'Document event outcomes and learnings', category: 'General' }
  ];
};

// Format task templates for display with numbering
export const formatTaskTemplatesForSelection = (templates: { title: string; description: string; category: string }[]): string => {
  let message = '';
  const categories = [...new Set(templates.map(t => t.category))];
  
  categories.forEach(category => {
    message += `\n**${category}:**\n`;
    const categoryTasks = templates.filter(t => t.category === category);
    categoryTasks.forEach((task) => {
      const globalIndex = templates.indexOf(task) + 1;
      message += `${globalIndex}. ${task.title} - ${task.description}\n`;
    });
  });
  
  return message;
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
