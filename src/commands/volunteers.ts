import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';
import { 
  formatVolunteerStatus, 
  canVolunteerCommit,
  formatTaskStatus,
  checkAndPromoteVolunteers,
  processMonthlyVolunteerStatus
} from '../utils';

// /onboard command - explains volunteer system and common roles
export const onboardCommand = async (ctx: CommandContext<Context>) => {
  const message = `🌟 **Welcome to our Volunteer Program!** 🌟

**How it works:**
• New volunteers start in **probation status**
• Complete **3 commitments within 3 months** to become an active volunteer
• Active volunteers get access to additional opportunities and recognition

**Common volunteer roles:**
• **Date Confirmation** - Coordinate with speakers/venues for scheduling
• **Speaker Confirmation** - Reach out to and confirm speakers
• **Venue Confirmation** - Secure and confirm event venues
• **Pre-event Marketing** - Promote upcoming events
• **Post-event Marketing** - Share event highlights and follow-ups
• **Moderator** - Guide panel discussions and Q&A sessions
• **Facilitator** - Lead workshops and interactive sessions

**Available commands:**
• \`/my_status\` - Check your volunteer status and progress
• \`/commit <event_id> <role>\` - Sign up for a role in an event

Ready to make a difference? Use \`/my_status\` to see your current standing!`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
};

// /my_status command - shows probation status, commitments completed, full volunteer status
export const myStatusCommand = async (ctx: CommandContext<Context>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this bot.');
    return;
  }

  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  
  if (!volunteer) {
    await ctx.reply(
      `👋 You're not registered as a volunteer yet!\n\n` +
      `To get started, please contact an admin or use /onboard to learn more about our volunteer program.`
    );
    return;
  }

  const statusMessage = formatVolunteerStatus(volunteer);
  await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
};

// /commit command - volunteer commits to a task
export const commitCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ') || [];
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Your Telegram account must have a username to use this command.');
    return;
  }

  if (args.length !== 1) {
    await ctx.reply(
      '❌ **Usage:** `/commit <task_id>`\n\n' +
      'Use `/list_events` to see available events and their tasks.\n\n' +
      '**Example:** `/commit 5`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const taskId = parseInt(args[0] || '');

  // Validate task ID
  if (isNaN(taskId)) {
    await ctx.reply('❌ Invalid task ID. Please provide a valid number.');
    return;
  }

  // Check if volunteer exists
  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  
  if (!volunteer) {
    await ctx.reply('❌ You need to be registered as a volunteer first. Contact an admin to get started.');
    return;
  }

  // Check if task exists
  const task = await DrizzleDatabaseService.getTask(taskId);
  
  if (!task) {
    await ctx.reply('❌ Task not found. Please check the task ID.');
    return;
  }

  // Check if volunteer can commit to this task
  const { canCommit, reason } = await canVolunteerCommit(volunteer.id, taskId);
  
  if (!canCommit) {
    await ctx.reply(`❌ ${reason}`);
    return;
  }

  // Assign volunteer to task
  const success = await DrizzleDatabaseService.assignVolunteerToTask(taskId, volunteer.id);
  
  if (!success) {
    await ctx.reply('❌ Failed to assign task. Please try again later.');
    return;
  }

  // Increment volunteer commitments
  await DrizzleDatabaseService.incrementVolunteerCommitments(volunteer.id);

  // Check for promotion after commitment
  await checkAndPromoteVolunteers(ctx.api as any);

  // Get event details for confirmation
  const event = await DrizzleDatabaseService.getEvent(task.event_id);
  
  await ctx.reply(
    `✅ **Successfully committed to task!**\n\n` +
    `Task: ${task.title}\n` +
    `Event: ${event?.title || 'Unknown'}\n` +
    `Your commitment count: ${volunteer.commitments + 1}\n\n` +
    `Thank you for volunteering! 🙏`,
    { parse_mode: 'Markdown' }
  );
};

// /assign_task command (admin only) - assign volunteer to task
export const assignTaskCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ') || [];
  
  if (args.length !== 2) {
    await ctx.reply(
      '❌ **Usage:** `/assign_task <task_id> @volunteer`\n\n' +
      '**Example:** `/assign_task 5 @johndoe`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const taskId = parseInt(args[0]!);
  const telegramHandle = args[1]?.replace('@', '') || '';

  if (isNaN(taskId)) {
    await ctx.reply('❌ Invalid task ID. Please provide a valid number.');
    return;
  }

  // Check if task exists
  const task = await DrizzleDatabaseService.getTask(taskId);
  if (!task) {
    await ctx.reply('❌ Task not found.');
    return;
  }

  // Check if volunteer exists
  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  if (!volunteer) {
    await ctx.reply('❌ Volunteer not found.');
    return;
  }

  // Assign volunteer to task
  const success = await DrizzleDatabaseService.assignVolunteerToTask(taskId, volunteer.id, ctx.from?.id);
  
  if (success) {
    const event = await DrizzleDatabaseService.getEvent(task.event_id);
    await ctx.reply(
      `✅ **Task assigned successfully!**\n\n` +
      `Task: ${task.title}\n` +
      `Event: ${event?.title || 'Unknown'}\n` +
      `Assigned to: ${volunteer.name} (@${volunteer.telegram_handle})`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to assign task. Please try again.');
  }
};

// /update_task_status command - update task status
export const updateTaskStatusCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ') || [];
  
  if (args.length !== 2) {
    await ctx.reply(
      '❌ **Usage:** `/update_task_status <task_id> <status>`\n\n' +
      '**Available statuses:** todo, in_progress, complete\n\n' +
      '**Example:** `/update_task_status 5 complete`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const taskId = parseInt(args[0]!);
  const status = args[1] as 'todo' | 'in_progress' | 'complete';

  if (isNaN(taskId)) {
    await ctx.reply('❌ Invalid task ID. Please provide a valid number.');
    return;
  }

  const validStatuses = ['todo', 'in_progress', 'complete'];
  if (!validStatuses.includes(status)) {
    await ctx.reply('❌ Invalid status. Use: todo, in_progress, or complete');
    return;
  }

  // Check if task exists
  const task = await DrizzleDatabaseService.getTask(taskId);
  if (!task) {
    await ctx.reply('❌ Task not found.');
    return;
  }

  // Update task status
  const success = await DrizzleDatabaseService.updateTaskStatus(taskId, status);
  
  if (success) {
    const event = await DrizzleDatabaseService.getEvent(task.event_id);
    await ctx.reply(
      `✅ **Task status updated!**\n\n` +
      `Task: ${task.title}\n` +
      `Event: ${event?.title || 'Unknown'}\n` +
      `New status: ${formatTaskStatus(status)}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to update task status. Please try again.');
  }
};

// /monthly_report command (admin only) - generate monthly volunteer status report
export const monthlyReportCommand = async (ctx: CommandContext<Context>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this bot.');
    return;
  }

  // Check if user is admin
  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  if (!isAdmin) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  await ctx.reply('📊 Generating monthly volunteer status report...');
  
  try {
    const reportMessage = await processMonthlyVolunteerStatus(ctx.api as any);
    await ctx.reply(reportMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    await ctx.reply('❌ Failed to generate monthly report. Please try again later.');
  }
};

// /volunteer_status_report command (admin only) - get current volunteer status without processing
export const volunteerStatusReportCommand = async (ctx: CommandContext<Context>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this bot.');
    return;
  }

  // Check if user is admin
  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  if (!isAdmin) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    const report = await DrizzleDatabaseService.getVolunteerStatusReport();
    
    let message = `📊 **Current Volunteer Status Report**\n\n`;
    message += `👥 **Total Volunteers:** ${report.total}\n\n`;
    
    if (report.lead.length > 0) {
      message += `🌟 **Lead Volunteers (${report.lead.length}):**\n`;
      report.lead.forEach(v => {
        message += `• ${v.name} (@${v.telegram_handle}) - ${v.commitments} commitments\n`;
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
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error generating status report:', error);
    await ctx.reply('❌ Failed to generate status report. Please try again later.');
  }
};

// /start command handler - for tests
export const handleStartCommand = async (ctx: CommandContext<Context>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this bot.');
    return;
  }

  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  
  if (!volunteer) {
    // Create new volunteer
    const name = ctx.from?.first_name || 'Unknown';
    const newVolunteer = await DrizzleDatabaseService.createVolunteer(name, telegramHandle, 'probation');
    
    if (newVolunteer) {
      await ctx.reply(
        `👋 Welcome ${name}! You've been registered as a new volunteer.\n\n` +
        `Use /onboard to learn about our volunteer program and /my_status to check your progress.`
      );
    } else {
      await ctx.reply('❌ Failed to register you as a volunteer. Please try again later.');
    }
  } else {
    await ctx.reply(
      `👋 Welcome back ${volunteer.name}!\n\n` +
      `Use /my_status to check your current volunteer status and /onboard to review the volunteer program.`
    );
  }
};
