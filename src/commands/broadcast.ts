import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';

// Escape special characters for Telegram Markdown (v1) parse_mode
// Only escape characters that affect formatting to prevent visible backslashes
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]`])/g, '\\$1');
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
    // Get volunteer status report
    const volunteers = await DrizzleDatabaseService.getAllVolunteers();
    
    if (volunteers.length === 0) {
      await ctx.reply('❌ No volunteers to broadcast.');
      return;
    }
    
    let broadcastMessage = '📋 *Current Volunteer Status*\n\n';
    
    // Group volunteers by status
    const probationVolunteers = volunteers.filter(v => v.status === 'probation');
    const activeVolunteers = volunteers.filter(v => v.status === 'active');
    const leadVolunteers = volunteers.filter(v => v.status === 'lead');
    const inactiveVolunteers = volunteers.filter(v => v.status === 'inactive');
    
    if (probationVolunteers.length > 0) {
      broadcastMessage += '*🟡 Probation Volunteers:*\n';
      probationVolunteers.forEach(volunteer => {
        const safeName = escapeMarkdown(volunteer.name);
        const start = new Date((volunteer as any).commit_count_start_date || volunteer.updated_at);
        const endText = (volunteer as any).probation_end_date ? new Date((volunteer as any).probation_end_date).toLocaleDateString() : 'present';
        broadcastMessage += `• ${safeName} - ${volunteer.commitments}/3 commitments (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
      });
      broadcastMessage += '\n';
    }
    
    if (activeVolunteers.length > 0) {
      broadcastMessage += '*🟢 Active Volunteers:*\n';
      activeVolunteers.forEach(volunteer => {
        const safeName = escapeMarkdown(volunteer.name);
        const start = new Date((volunteer as any).commit_count_start_date || volunteer.updated_at);
        const endText = (volunteer as any).probation_end_date ? new Date((volunteer as any).probation_end_date).toLocaleDateString() : 'present';
        broadcastMessage += `• ${safeName} - ${volunteer.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
      });
      broadcastMessage += '\n';
    }
    
    if (leadVolunteers.length > 0) {
      broadcastMessage += '*⭐ Lead Volunteers:*\n';
      leadVolunteers.forEach(volunteer => {
        const safeName = escapeMarkdown(volunteer.name);
        broadcastMessage += `• ${safeName} - ${volunteer.commitments} commitments\n`;
      });
      broadcastMessage += '\n';
    }
    
    if (inactiveVolunteers.length > 0) {
      broadcastMessage += '*⚫ Inactive Volunteers:*\n';
      inactiveVolunteers.forEach(volunteer => {
        const safeName = escapeMarkdown(volunteer.name);
        const start = new Date((volunteer as any).commit_count_start_date || volunteer.updated_at);
        const endText = (volunteer as any).probation_end_date ? new Date((volunteer as any).probation_end_date).toLocaleDateString() : 'present';
        broadcastMessage += `• ${safeName} - ${volunteer.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
      });
    }
    
    const options: any = { parse_mode: 'Markdown' };
    await ctx.api.sendMessage(groupId, broadcastMessage, options);
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
    const events = await DrizzleDatabaseService.getAllEvents();
    
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
    // Get all events
    const events = await DrizzleDatabaseService.getAllEvents();

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
