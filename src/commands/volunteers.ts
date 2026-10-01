import { Context, CommandContext, InlineKeyboard } from 'grammy';
import fs from 'fs/promises';
import path from 'path';
import { DrizzleDatabaseService } from '../db-drizzle';
import {
  formatVolunteerStatus,
  canVolunteerCommit,
  formatTaskStatus,
  promoteIfEligible
} from '../utils';
import { TASKS } from '../utils/task-templates';

// Escape special characters for Telegram Markdown (v1) parse_mode
// Only escape characters that affect formatting to prevent visible backslashes
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]`])/g, '\\$1');
};

// /onboard command - explains volunteer system and common roles
// ==== Onboarding (interactive, file-driven) ====
const ONBOARD_DIRS = [
  path.resolve(__dirname, '../onboarding-pages'),           // src runtime
  path.resolve(__dirname, '../../src/onboarding-pages'),    // dist runtime fallback
];

async function readOnboardingFiles(): Promise<string[]> {
  for (const dir of ONBOARD_DIRS) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.html'))
        .map(e => path.join(dir, e.name))
        .sort();
      if (files.length > 0) return files;
    } catch (_) {
      // try next dir
    }
  }
  return [];
}

async function getOnboardingPages(): Promise<{ title: string; content: string }[]> {
  const files = await readOnboardingFiles();
  const pages: { title: string; content: string }[] = [];
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    // Extract first <b>...</b> as title if present
    const match = raw.match(/<b>(.*?)<\/b>/i);
    const title: string = match ? (match[1] as string) : path.basename(file);
    pages.push({ title, content: raw });
  }
  return pages;
}

function buildOnboardKeyboard(index: number, total: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const hasPrev = index > 0;
  const hasNext = index < total - 1;
  if (hasPrev) kb.text('⬅️ Prev', `onboard:${index - 1}`);
  kb.text(`Page ${index + 1}/${total}`, 'onboard:noop');
  if (hasNext) kb.text('Next ➡️', `onboard:${index + 1}`);
  return kb;
}

export const onboardCommand = async (ctx: CommandContext<Context>) => {
  const pages = await getOnboardingPages();
  if (pages.length === 0) {
    await ctx.reply('❌ Onboarding pages not found. Please add HTML files under src/onboarding-pages/.');
    return;
  }
  const idx = 0;
  const kb = buildOnboardKeyboard(idx, pages.length);
  const page = pages[idx]!;
  const header = `<b>Onboarding</b> — ${page.title}`;
  const message = `${header}\n\n${page.content}`;
  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
};

export const handleOnboardCallback = async (ctx: Context) => {
  const data = ctx.callbackQuery?.data || '';
  if (!data.startsWith('onboard:')) return; // not our callback
  if (data === 'onboard:noop') {
    await ctx.answerCallbackQuery();
    return;
  }
  const [, indexStr] = data.split(':');
  const index = parseInt(indexStr || '0', 10);
  const pages = await getOnboardingPages();
  if (pages.length === 0) {
    await ctx.answerCallbackQuery({ text: 'No onboarding pages found.' });
    return;
  }
  const safeIndex = Math.max(0, Math.min(index, pages.length - 1));
  const kb = buildOnboardKeyboard(safeIndex, pages.length);
  const page = pages[safeIndex]!;
  const header = `<b>Onboarding</b> — ${page.title}`;
  const message = `${header}\n\n${page.content}`;
  try {
    await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    await ctx.answerCallbackQuery();
  } catch (e) {
    // If message can't be edited (e.g., too old), send a new one
    await ctx.answerCallbackQuery();
    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
  }
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
  await ctx.reply(statusMessage, { parse_mode: 'HTML' });
};

// /my_tasks command - shows list of tasks assigned to the volunteer that are not completed
export const myTasksCommand = async (ctx: CommandContext<Context>) => {
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

  // filter out completed tasks
  const allTasks = await DrizzleDatabaseService.getVolunteerTasks(volunteer.id);
  const activeTasks = allTasks.filter(task => task.status !== 'complete');
  
  if (activeTasks.length === 0) {
    await ctx.reply(
      `📋 **My Tasks**\n\n` +
      `You currently have no active tasks assigned.\n\n` +
      `💡 Use \`/list_events\` to see available events and \`/commit <task_id>\` to sign up for tasks!`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let message = `📋 **My Active Tasks** (${activeTasks.length})\n\n`;
  let taskNumber = 1;
  
  for (const task of activeTasks) {
    //get event details
    const event = await DrizzleDatabaseService.getEvent(task.event_id);
    const eventTitle = event?.title ? escapeMarkdown(event.title) : 'Unknown Event';
    const taskTitle = escapeMarkdown(task.title);
    const taskStatus = formatTaskStatus(task.status);
    message += `${taskNumber++}. **Task #${task.id}:** ${taskTitle}\n`;
    message += `   Event: ${eventTitle} (ID: ${task.event_id})\n`;
    message += `   Status: ${taskStatus}\n`;
    
    if (task.description) {
      const taskDescription = escapeMarkdown(task.description);
      message += `   Description: ${taskDescription}\n`;
    }
    
    message += `\n`;
  }
  
  message += `💡 Use \`/event_details <event_id>\` to see more details about an event.\n`;
  message += `💡 Use \`/uncommit <task_id>\` to remove yourself from a task.\n`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
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

  // Check if task is already complete
  if (task.status === 'complete') {
    await ctx.reply('❌ Task is already complete!');
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

  // Note: Commit count will be incremented when admin marks task as complete

  // Get event details for confirmation
  const event = await DrizzleDatabaseService.getEvent(task.event_id);
  
  const safeTaskTitle = escapeMarkdown(task.title);
  const safeEventTitle = event?.title ? escapeMarkdown(event.title) : 'Unknown';
  const template = TASKS.find(t => t.title === task.title);
  const guidanceNote = template?.guidance ? `\n\n📌 *Guidance:* ${escapeMarkdown(template.guidance)}` : '';
  await ctx.reply(
    `✅ **Successfully committed to task!**\n\n` +
    `Task: ${safeTaskTitle}\n` +
    `Event: ${safeEventTitle}\n` +
    `Your current commitment count: ${volunteer.commitments}\n\n` +
    `💡 Your commitment count will increase by 1 when an admin marks this task as complete.\n\n` +
    `Thank you for volunteering! 🙏` +
    guidanceNote,
    { parse_mode: 'Markdown' }
  );
};

/** /uncommit command - allows volunteer to remove themselves from a task */
export const uncommitCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ') || [];
  const telegramHandle = ctx.from?.username;

  if (!telegramHandle) {
    await ctx.reply('❌ Your Telegram account must have a username to use this command.');
    return;
  }

  if (args.length !== 1) {
    await ctx.reply(
      '❌ **Usage:** `/uncommit <task_id>`\n\n' +
      '**Example:** `/uncommit 5`',
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
    await ctx.reply('❌ You need to be registered as a volunteer first.');
    return;
  }

  // Check if task exists
  const task = await DrizzleDatabaseService.getTask(taskId);

  if (!task) {
    await ctx.reply('❌ Task not found. Please check the task ID.');
    return;
  }

  // Check if task is already complete
  if (task.status === 'complete') {
    await ctx.reply('❌ Cannot uncommit from a completed task.');
    return;
  }

  // Check if volunteer is assigned to this task
  const assignments = await DrizzleDatabaseService.getTaskAssignments(taskId);
  const isAssigned = assignments.some(a => a.volunteer_id === volunteer.id);

  if (!isAssigned) {
    await ctx.reply('❌ You are not currently assigned to this task.');
    return;
  }

  // Remove volunteer from task
  const success = await DrizzleDatabaseService.removeVolunteerFromTask(taskId, volunteer.id);

  if (!success) {
    await ctx.reply('❌ Failed to remove assignment. Please try again later.');
    return;
  }

  // Get event details for confirmation
  const event = await DrizzleDatabaseService.getEvent(task.event_id);

  const safeTaskTitle = escapeMarkdown(task.title);
  const safeEventTitle = event?.title ? escapeMarkdown(event.title) : 'Unknown';
  await ctx.reply(
    `✅ **Successfully uncommitted from task**\n\n` +
    `Task: ${safeTaskTitle}\n` +
    `Event: ${safeEventTitle}\n\n` +
    `You have been removed from this task.`,
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

  // Check if task is already complete
  if (task.status === 'complete') {
    await ctx.reply('❌ Task is already complete!');
    return;
  }

  // Check if volunteer exists
  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  if (!volunteer) {
    await ctx.reply('❌ Volunteer not found.');
    return;
  }

  // Determine assigned_by: use admin's volunteer ID if admin is also a registered volunteer
  let assignedByVolunteerId: number | undefined = undefined;
  const adminHandle = ctx.from?.username;
  if (adminHandle) {
    const adminVolunteer = await DrizzleDatabaseService.getVolunteerByHandle(adminHandle);
    if (adminVolunteer) {
      assignedByVolunteerId = adminVolunteer.id;
    }
  }

  // Assign volunteer to task
  const success = await DrizzleDatabaseService.assignVolunteerToTask(taskId, volunteer.id, assignedByVolunteerId);
  
  if (success) {
    const event = await DrizzleDatabaseService.getEvent(task.event_id);
    const safeTaskTitle = escapeMarkdown(task.title);
    const safeEventTitle = event?.title ? escapeMarkdown(event.title) : 'Unknown';
    const safeName = escapeMarkdown(volunteer.name);
    const safeHandle = escapeMarkdown(volunteer.telegram_handle);
    await ctx.reply(
      `✅ **Task assigned successfully!**\n\n` +
      `Task: ${safeTaskTitle}\n` +
      `Event: ${safeEventTitle}\n` +
      `Assigned to: ${safeName} (@${safeHandle})`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to assign task. Please try again.');
  }
};

// /update_task_status command - update task status
export const updateTaskStatusCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ') || [];

  const statusHelp =
    '❓ Task status options:\n' +
    '• `todo` — Task has not been started yet\n' +
    '• `in_progress` — Work is currently underway\n' +
    '• `complete` — Task has been finished (increments volunteer commitments)\n\n' +
    '✅ Usage: `/update_task_status <task_id> <status>`\n' +
    'Example: `/update_task_status 12 in_progress`\n' +
    'Example: `/update_task_status 12 complete`';

  if (args.length < 2) {
    await ctx.reply(statusHelp, { parse_mode: 'Markdown' });
    return;
  }

  const taskId = Number(args[0] ?? '');
  const status = args[1] as 'todo' | 'in_progress' | 'complete';

  if (isNaN(taskId)) {
    await ctx.reply('❌ Invalid task ID.\n\n' + statusHelp, { parse_mode: 'Markdown' });
    return;
  }

  if (!['todo', 'in_progress', 'complete'].includes(status)) {
    await ctx.reply('❌ Invalid status.\n\n' + statusHelp, { parse_mode: 'Markdown' });
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
    let responseMessage = '';
    
    // If task was marked as complete AND it wasn't already complete, show feedback about commitment increments
    if (status === 'complete' && task.status !== 'complete') {
      const assignments = await DrizzleDatabaseService.getTaskAssignments(taskId);
      for (const assignment of assignments) {
        // Fetch updated volunteer data to show new commitment count
        const volunteer = await DrizzleDatabaseService.getVolunteerById(assignment.volunteer_id);
        if (volunteer) {
          const safeName = escapeMarkdown(volunteer.name);
          const safeHandle = escapeMarkdown(volunteer.telegram_handle);
          responseMessage += `🎉 ${safeName} (@${safeHandle}) commitment count increased to ${volunteer.commitments}!\n`;
        }
      }
    }
    
    
    const event = await DrizzleDatabaseService.getEvent(task.event_id);
    const safeTaskTitle2 = escapeMarkdown(task.title);
    const safeEventTitle2 = event?.title ? escapeMarkdown(event.title) : 'Unknown';
    await ctx.reply(
      `✅ **Task status updated!**\n\n` +
      `Task: ${safeTaskTitle2}\n` +
      `Event: ${safeEventTitle2}\n` +
      `New status: ${formatTaskStatus(status)}\n\n` +
      responseMessage,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to update task status. Please try again.');
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
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments (${v.cumulative_commitments} total)\n`;
      });
      message += `\n`;
    }
    
    if (report.active.length > 0) {
      message += `✅ **Active Volunteers (${report.active.length}):**\n`;
      report.active.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        const start = new Date((v as any).commit_count_start_date || v.updated_at);
        const endText = (v as any).probation_end_date ? new Date((v as any).probation_end_date).toLocaleDateString() : 'present';
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText}, ${v.cumulative_commitments} total)\n`;
      });
      message += `\n`;
    }
    
    if (report.probation.length > 0) {
      message += `🔄 **Probation Volunteers (${report.probation.length}):**\n`;
      report.probation.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        const start = new Date((v as any).commit_count_start_date || v.updated_at);
        const endText = (v as any).probation_end_date ? new Date((v as any).probation_end_date).toLocaleDateString() : 'present';
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText}, ${v.cumulative_commitments} total)\n`;
      });
      message += `\n`;
    }
    
    if (report.inactive.length > 0) {
      message += `⚠️ **Inactive Volunteers (${report.inactive.length}):**\n`;
      report.inactive.forEach(v => {
        const safeName = escapeMarkdown(v.name);
        const safeHandle = escapeMarkdown(v.telegram_handle);
        const start = new Date((v as any).commit_count_start_date || v.updated_at);
        const endText = (v as any).probation_end_date ? new Date((v as any).probation_end_date).toLocaleDateString() : 'present';
        message += `• ${safeName} (@${safeHandle}) - ${v.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText}, ${v.cumulative_commitments} total)\n`;
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
