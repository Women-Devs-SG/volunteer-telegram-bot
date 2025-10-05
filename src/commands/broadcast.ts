import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';
import { formatEventDetails, formatHumanDate } from '../utils';

// Escape special characters for Telegram HTML parse_mode
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// Escape special characters for Telegram Markdown (v1) parse_mode
// Only escape characters that affect formatting to prevent visible backslashes
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]`])/g, '\\$1');
};

// /broadcast_event_details <event_id> - broadcast details of a single event
export const broadcastEventDetailsCommand = async (ctx: CommandContext<Context>) => {
  const { groupId } = getGroupInfo('VOLUNTEER_GROUP_ID');
  if (!groupId) {
    await ctx.reply('❌ No volunteer group configured. Please set VOLUNTEER_GROUP_ID in environment variables.');
    return;
  }

  const callerHandle = ctx.from?.username;
  if (!callerHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this command.');
    return;
  }

  const arg = ctx.match?.toString().trim();
  if (!arg) {
    await ctx.reply('❌ Usage: `/broadcast_event_details <event_id>`', { parse_mode: 'Markdown' });
    return;
  }
  const eventId = parseInt(arg, 10);
  if (isNaN(eventId)) {
    await ctx.reply('❌ Invalid event ID.');
    return;
  }

  try {
    const event = await DrizzleDatabaseService.getEvent(eventId);
    if (!event) {
      await ctx.reply('❌ Event not found.');
      return;
    }
    // Permission: admins can broadcast any; non-admins only their own events
    const isAdmin = await DrizzleDatabaseService.isAdmin(callerHandle);
    if (!isAdmin) {
      const me = await DrizzleDatabaseService.getVolunteerByHandle(callerHandle);
      if (!me || event.created_by !== me.id) {
        await ctx.reply('❌ You can only broadcast events you created.');
        return;
      }
    }

    // Save pending confirmation and prompt
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ Unable to identify user.');
      return;
    }
    broadcastConfirmState.set(userId, { eventId });
    await ctx.reply(
      `📣 You are about to broadcast event ID <b>${eventId}</b> to the group.\n\n` +
      'Type <b>YES</b> to confirm, or <b>CANCEL</b> to abort.',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Error preparing broadcast event details:', error);
    await ctx.reply('❌ Failed to prepare broadcast. Please check the logs.');
  }
};

// Pending confirmations keyed by user id
const broadcastConfirmState = new Map<number, { eventId: number }>();

// Handle confirmation replies for broadcast_event_details
export const handleBroadcastEventDetailsConfirmation = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return;
  const pending = broadcastConfirmState.get(userId);
  if (!pending) return;

  const choice = text.toLowerCase();
  if (choice === 'cancel') {
    broadcastConfirmState.delete(userId);
    await ctx.reply('✅ Broadcast cancelled.');
    return;
  }
  if (choice !== 'yes' && choice !== 'confirm') {
    await ctx.reply('❌ Please reply with YES to confirm or CANCEL to abort.');
    return;
  }

  // Proceed with broadcast
  try {
    const { groupId } = getGroupInfo('VOLUNTEER_GROUP_ID');
    if (!groupId) {
      await ctx.reply('❌ No volunteer group configured. Please set VOLUNTEER_GROUP_ID in environment variables.');
      broadcastConfirmState.delete(userId);
      return;
    }
    const event = await DrizzleDatabaseService.getEvent(pending.eventId);
    if (!event) {
      await ctx.reply('❌ Event not found.');
      broadcastConfirmState.delete(userId);
      return;
    }
    const tasks = await DrizzleDatabaseService.getEventTasks(pending.eventId);
    const details = await formatEventDetails(event, tasks);
    await ctx.api.sendMessage(groupId, `📢 <b>Event Announcement</b>\n\n${details}`, { parse_mode: 'HTML' });
    await ctx.reply('✅ Event details broadcast sent successfully!');
  } catch (error) {
    console.error('Error sending broadcast event details:', error);
    await ctx.reply('❌ Failed to send broadcast. Please check the logs.');
  } finally {
    broadcastConfirmState.delete(userId);
  }
};

// Helper function to get target group from environment
const getGroupInfo = (groupEnvVar: string) => {
  const groupId = process.env[groupEnvVar];
  return { groupId };
};

// /broadcast command - main broadcast menu
export const broadcastCommand = async (ctx: CommandContext<Context>) => {
  const groupInfo = process.env.VOLUNTEER_GROUP_ID || 'Not configured';
  
  const message = `📢 *Broadcast Menu*\n\n` +
    `Choose what to broadcast:\n\n` +
    `1️⃣ \`/broadcast_volunteers\` \\- Current volunteer status list\n` +
    `2️⃣ \`/broadcast_events\` \\- List of upcoming events\n` +
    `3️⃣ \`/broadcast_tasks\` \\- Available tasks needing volunteers\n` +
    `4️⃣ \`/broadcast_custom <message>\` \\- Send custom message\n\n` +
    `*Target Group:* ${escapeMarkdown(groupInfo)}`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
};

// /broadcast_volunteers command - broadcast volunteer status
export const broadcastVolunteersCommand = async (ctx: CommandContext<Context>) => {
  const { groupId } = getGroupInfo('VOLUNTEER_GROUP_ID');
  
  if (!groupId) {
    await ctx.reply('❌ No volunteer group configured. Please set VOLUNTEER_GROUP_ID in environment variables.');
    return;
  }
  
  try {
    const volunteers = await DrizzleDatabaseService.getAllVolunteers();
    
    if (volunteers.length === 0) {
      await ctx.reply('❌ No volunteers to broadcast.');
      return;
    }

    let message = '📋 <b>All Volunteers</b>\n\n';
    const ref = volunteers[0]! as any;
    const refStart = ref.commit_count_start_date ? formatHumanDate(new Date(ref.commit_count_start_date)) : formatHumanDate(new Date(ref.updated_at));
    const refEndText = ref.probation_end_date ? formatHumanDate(new Date(ref.probation_end_date)) : 'present';
    message += `📅 Tracking period: ${refStart} → ${refEndText}\n\n`;

    const probationVolunteers = volunteers.filter(v => v.status === 'probation');
    const activeVolunteers = volunteers.filter(v => v.status === 'active');
    const leadVolunteers = volunteers.filter(v => v.status === 'lead');
    const inactiveVolunteers = volunteers.filter(v => v.status === 'inactive');

    if (probationVolunteers.length > 0) {
      message += '🟡 <b>Probation Volunteers:</b>\n';
      probationVolunteers.forEach(v => {
        const safeName = escapeHtml(v.name);
        const safeHandle = escapeHtml(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments}/3 commitments\n`;
      });
      message += '\n';
    }

    if (activeVolunteers.length > 0) {
      message += '🟢 <b>Active Volunteers:</b>\n';
      activeVolunteers.forEach(v => {
        const safeName = escapeHtml(v.name);
        const safeHandle = escapeHtml(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments\n`;
      });
      message += '\n';
    }

    if (inactiveVolunteers.length > 0) {
      message += '⚫ <b>Inactive Volunteers:</b>\n';
      inactiveVolunteers.forEach(v => {
        const safeName = escapeHtml(v.name);
        const safeHandle = escapeHtml(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments\n`;
      });
      message += '\n';
    }

    if (leadVolunteers.length > 0) {
      message += '⭐ <b>Lead Volunteers:</b>\n';
      leadVolunteers.forEach(v => {
        const safeName = escapeHtml(v.name);
        const safeHandle = escapeHtml(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments\n`;
      });
    }

    await ctx.api.sendMessage(groupId, message, { parse_mode: 'HTML' });
    await ctx.reply('✅ Volunteer status broadcast sent successfully!');
    
  } catch (error) {
    console.error('Error broadcasting volunteers:', error);
    await ctx.reply('❌ Failed to send broadcast. Please check the logs.');
  }
};

// /broadcast_events command - broadcast upcoming events
export const broadcastEventsCommand = async (ctx: CommandContext<Context>) => {
  const { groupId } = getGroupInfo('VOLUNTEER_GROUP_ID');
  
  if (!groupId) {
    await ctx.reply('❌ No volunteer group configured. Please set VOLUNTEER_GROUP_ID in environment variables.');
    return;
  }
  
  try {
    const events = await DrizzleDatabaseService.getAllIncompleteEvents();
    
    if (events.length === 0) {
      await ctx.reply('❌ No events to broadcast.');
      return;
    }
    
    let broadcastMessage = '📅 *Upcoming Events*\n\n';
    
    events.forEach(event => {
      const eventDate = new Date(event.date).toLocaleDateString();
      const escapedTitle = escapeMarkdown(event.title);
      const escapedVenue = escapeMarkdown(event.venue || 'TBD');
      const escapedFormat = escapeMarkdown(event.format);
      
      broadcastMessage += `*${escapedTitle}*\n`;
      broadcastMessage += `📍 ${escapedVenue}\n`;
      broadcastMessage += `📅 ${eventDate}\n`;
      broadcastMessage += `🎯 ${escapedFormat}\n`;
      if (event.details) {
        const escapedDetails = escapeMarkdown(event.details);
        broadcastMessage += `📝 ${escapedDetails}\n`;
      }
      broadcastMessage += '\n';
    });
    
    const options: any = { parse_mode: 'Markdown' };
    await ctx.api.sendMessage(groupId, broadcastMessage, options);
    await ctx.reply('✅ Events broadcast sent successfully!');
    
  } catch (error) {
    console.error('Error broadcasting events:', error);
    await ctx.reply('❌ Failed to send broadcast. Please check the logs.');
  }
};

// /broadcast_tasks command - broadcast available tasks
export const broadcastTasksCommand = async (ctx: CommandContext<Context>) => {
  const { groupId } = getGroupInfo('VOLUNTEER_GROUP_ID');
  
  if (!groupId) {
    await ctx.reply('❌ No volunteer group configured. Please set VOLUNTEER_GROUP_ID in environment variables.');
    return;
  }
  
  try {
    // Get all incomplete events
    const events = await DrizzleDatabaseService.getAllIncompleteEvents();

    if (events.length === 0) {
      await ctx.reply('❌ No events with tasks to broadcast.');
      return;
    }

    const botHandle = process.env.TELEGRAM_BOT_HANDLE || '';
    const safeBotHandleText = botHandle ? escapeMarkdown(`@${botHandle}`) : '';
    const botLink = botHandle ? ` [${safeBotHandleText}](https://t.me/${botHandle})` : '';

    let broadcastMessage = '📋 *Volunteer Opportunities: Unassigned Tasks*\n\n';

    for (const event of events) {
      // Fetch tasks and filter to only unassigned
      const tasks = await DrizzleDatabaseService.getEventTasks(event.id);
      const unassigned: typeof tasks = [];
      for (const task of tasks) {
        const assignments = await DrizzleDatabaseService.getTaskAssignments(task.id);
        if (assignments.length === 0) {
          unassigned.push(task);
        }
      }

      if (unassigned.length === 0) continue;

      const eventDate = new Date(event.date).toLocaleDateString();
      const escapedTitle = escapeMarkdown(event.title);
      broadcastMessage += `*${escapedTitle}* — ${eventDate}\n`;

      unassigned.forEach(task => {
        const taskTitle = escapeMarkdown(task.title);
        broadcastMessage += `• ${taskTitle} (Task ID: ${task.id})\n`;
      });

      broadcastMessage += '\n';
    }

    // If nothing to show
    if (broadcastMessage.trim() === '📋 *Volunteer Opportunities: Unassigned Tasks*') {
      await ctx.reply('✅ All tasks are currently assigned.');
      return;
    }

    // Call to action
    broadcastMessage += '👉 To volunteer for a task, send a message to our bot' + (botLink || '') + '\n';
    broadcastMessage += 'Then use: \`/commit <task_id>\` (e.g., \`/commit 6\`)';

    const options: any = { parse_mode: 'Markdown' };
    await ctx.api.sendMessage(groupId, broadcastMessage, options);
    await ctx.reply('✅ Tasks broadcast sent successfully!');

  } catch (error) {
    console.error('Error broadcasting events:', error);
    await ctx.reply('❌ Failed to send broadcast. Please check the logs.');
  }
};

// /broadcast_custom command - broadcast custom message
export const broadcastCustomCommand = async (ctx: CommandContext<Context>) => {
  const customMessage = ctx.match?.toString().trim();
  
  if (!customMessage) {
    await ctx.reply(
      '❌ **Usage:** `/broadcast_custom <message>`\n\n' +
      '**Example:** `/broadcast_custom 🎉 Welcome to our volunteer program! Join us today.`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const { groupId } = getGroupInfo('VOLUNTEER_GROUP_ID');
  
  if (!groupId) {
    await ctx.reply('❌ No volunteer group configured. Please set VOLUNTEER_GROUP_ID in environment variables.');
    return;
  }
  
  try {
    const options: any = { parse_mode: 'Markdown' };
    const safeMessage = escapeMarkdown(customMessage);
    await ctx.api.sendMessage(groupId, safeMessage, options);
    await ctx.reply('✅ Custom message broadcast sent successfully!');
    
  } catch (error) {
    console.error('Error broadcasting custom message:', error);
    await ctx.reply('❌ Failed to send broadcast. Please check the logs.');
  }
};
