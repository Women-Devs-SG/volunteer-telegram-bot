import { Bot } from 'grammy';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import command handlers (parity with src/bot.ts)
import { 
  onboardCommand,
  handleOnboardCallback,
  myStatusCommand,
  commitCommand,
  assignTaskCommand,
  updateTaskStatusCommand,
  monthlyReportCommand,
  volunteerStatusReportCommand,
} from '../src/commands/volunteers';

import {
  requireAdmin,
  adminLoginCommand,
  listVolunteersCommand,
  addVolunteerCommand,
  removeVolunteerCommand,
  handleAddVolunteerWizard,
  setCommitCountCommand,
  removeAssignmentCommand,
  setStatusCommand,
  resetQuarterCommand,
  handleResetQuarterWizard,
  removeAdminCommand,
} from '../src/commands/admins';

import {
  createEventCommand,
  handleEventWizard,
  editEventCommand,
  handleEditEventWizard,
  listEventsCommand,
  eventDetailsCommand,
  removeEventCommand,
  handleRemoveEventConfirmation,
  cancelCommand,
} from '../src/commands/events';

import {
  broadcastCommand,
  broadcastVolunteersCommand,
  broadcastEventsCommand,
  broadcastTasksCommand,
  broadcastCustomCommand,
  broadcastEventDetailsCommand,
  handleBroadcastEventDetailsConfirmation,
} from '../src/commands/broadcast';

import { DrizzleDatabaseService } from '../src/db-drizzle';

// Validate required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Help message function (aligned with src/bot.ts)
const getHelpMessage = async (telegramHandle?: string) => {
  let message = `🤖 **Volunteer Management Bot**

Welcome! I help manage volunteer onboarding, event planning, and admin tasks.

**For Volunteers:**
• \`/onboard\` - Learn about the volunteer program
• \`/my_status\` - Check your volunteer status
• \`/commit <task_id>\` - Sign up for event tasks
• \`/list_events\` - View upcoming events
• \`/event_details <event_id>\` - View detailed event information
• \`/create_event\` - Create a new event (interactive)
• \`/edit_event <event_id>\` - Edit your own event (admins can edit any)`;

  if (telegramHandle) {
    const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
    if (isAdmin) {
      message += `

**For Admins:**
• \`/admin_login <secret>\` - Authenticate as admin
• \`/list_volunteers\` - View all volunteers
• \`/add_volunteer\` - Add new volunteer (interactive)
• \`/remove_volunteer @handle\` - Remove volunteer
• \`/remove_admin @handle\` - Remove admin access from a handle
• \`/create_event\` - Create new event (interactive with task selection)
• \`/edit_event <event_id>\` - Edit an event details/tasks (interactive)
• \`/remove_event <event_id>\` - Remove an event (admin)
• \`/assign_task <task_id> @volunteer\` - Assign tasks to volunteers
• \`/update_task_status <task_id> <todo/in_progress/complete>\` - Update task status (increments commits on complete)
• \`/remove_assignment <task_id> @volunteer\` - Remove a volunteer from a task
• \`/set_commit_count @volunteer <count>\` - Overwrite a volunteer's commit count
• \`/set_status @volunteer <probation/active/inactive>\` - Update a volunteer's status
• \`/monthly_report\` - Generate monthly volunteer status report
• \`/volunteer_status_report\` - View current volunteer status
• \`/broadcast\` - Show broadcast menu for testing
• \`/broadcast_volunteers\` - Broadcast volunteer status list
• \`/broadcast_events\` - Broadcast upcoming events
• \`/broadcast_event_details <event_id>\` - Broadcast a specific event's details
• \`/broadcast_tasks\` - Broadcast available tasks
• \`/broadcast_custom <message>\` - Send custom broadcast message
• \`/reset_quarter\` - Reset all commit counts to 0 (interactive, admin)`;
    } else {
      message += `

**For Admins:**
• If you are an admin, use \`/admin_login <secret>\` to access admin commands`;
    }
  }

  message += `

**General:**
• \`/start\` - Show welcome message
• \`/help\` - Show this help message
• \`/cancel\` - Cancel current operation

Let's get started! 🚀`;

  return message;
};

// Start command
bot.command('start', async (ctx) => {
  const telegramHandle = ctx.from?.username;
  const helpMessage = await getHelpMessage(telegramHandle);
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Help command
bot.command('help', async (ctx) => {
  const telegramHandle = ctx.from?.username;
  const helpMessage = await getHelpMessage(telegramHandle);
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Volunteer commands
bot.command('onboard', onboardCommand);
bot.command('onboarding', onboardCommand);
bot.command('my_status', myStatusCommand);
bot.command('commit', commitCommand);

// Admin authentication
bot.command('admin_login', adminLoginCommand);

// Admin commands (with authentication middleware)
bot.command('list_volunteers', requireAdmin, listVolunteersCommand);
bot.command('add_volunteer', requireAdmin, addVolunteerCommand);
bot.command('remove_volunteer', requireAdmin, removeVolunteerCommand);
bot.command('assign_task', requireAdmin, assignTaskCommand);
bot.command('update_task_status', requireAdmin, updateTaskStatusCommand);
bot.command('remove_assignment', requireAdmin, removeAssignmentCommand);
bot.command('set_commit_count', requireAdmin, setCommitCountCommand);
bot.command('set_status', requireAdmin, setStatusCommand);
bot.command('remove_admin', requireAdmin, removeAdminCommand);
bot.command('reset_quarter', requireAdmin, resetQuarterCommand);
bot.command('monthly_report', requireAdmin, monthlyReportCommand);
bot.command('volunteer_status_report', requireAdmin, volunteerStatusReportCommand);
bot.command('create_event', createEventCommand);
bot.command('edit_event', editEventCommand);
bot.command('remove_event', requireAdmin, removeEventCommand);

// Public event commands (same as src/bot.ts)
bot.command('list_events', listEventsCommand);
bot.command('event_details', eventDetailsCommand);

// Broadcast commands (admin only)
bot.command('broadcast', requireAdmin, broadcastCommand);
bot.command('broadcast_volunteers', requireAdmin, broadcastVolunteersCommand);
bot.command('broadcast_events', requireAdmin, broadcastEventsCommand);
bot.command('broadcast_event_details', broadcastEventDetailsCommand);
bot.command('broadcast_tasks', requireAdmin, broadcastTasksCommand);
bot.command('broadcast_custom', requireAdmin, broadcastCustomCommand);

// Utility commands
bot.command('cancel', cancelCommand);

// Handle text messages for interactive wizards
bot.on('message:text', async (ctx) => {
  // Handle event creation wizard
  await handleEventWizard(ctx);
  // Handle add volunteer wizard
  await handleAddVolunteerWizard(ctx);
  // Handle edit event wizard
  await handleEditEventWizard(ctx);
  // Handle remove event confirmation
  await handleRemoveEventConfirmation(ctx);
  // Handle reset quarter wizard
  await handleResetQuarterWizard(ctx);
  // Handle broadcast event details confirmation
  await handleBroadcastEventDetailsConfirmation(ctx);
});

// Handle onboarding navigation callbacks
bot.on('callback_query:data', async (ctx) => {
  await handleOnboardCallback(ctx);
});

// Initialize bot once
let botInitialized = false;

// Register bot commands for auto-completion (parity with src/bot.ts)
const setupBotCommands = async () => {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Show welcome message and help' },
      { command: 'help', description: 'Show all available commands' },
      { command: 'onboard', description: 'Learn about the volunteer program' },
      { command: 'onboarding', description: 'Learn about the volunteer program (interactive)' },
      { command: 'my_status', description: 'Check your volunteer status' },
      { command: 'commit', description: 'Sign up for event tasks' },
      { command: 'admin_login', description: 'Authenticate as admin' },
      { command: 'list_volunteers', description: 'View all volunteers (admin)' },
      { command: 'add_volunteer', description: 'Add new volunteer (interactive, admin)' },
      { command: 'remove_volunteer', description: 'Remove volunteer (admin)' },
      { command: 'create_event', description: 'Create new event with task selection' },
      { command: 'edit_event', description: 'Edit an event details/tasks (own events for non-admins)' },
      { command: 'assign_task', description: 'Assign tasks to volunteers (admin)' },
      { command: 'update_task_status', description: 'Update task status (admin)' },
      { command: 'remove_assignment', description: 'Remove a volunteer from a task (admin)' },
      { command: 'set_commit_count', description: 'Overwrite a volunteer\'s commit count (admin)' },
      { command: 'set_status', description: 'Update a volunteer\'s status (admin)' },
      { command: 'monthly_report', description: 'Generate monthly volunteer status report (admin)' },
      { command: 'volunteer_status_report', description: 'View current volunteer status (admin)' },
      { command: 'list_events', description: 'View upcoming events with tasks' },
      { command: 'event_details', description: 'View detailed event information' },
      { command: 'remove_event', description: 'Remove an event (admin)' },
      { command: 'broadcast', description: 'Show broadcast menu (admin)' },
      { command: 'broadcast_volunteers', description: 'Broadcast volunteer status (admin)' },
      { command: 'broadcast_events', description: 'Broadcast upcoming events (admin)' },
      { command: 'broadcast_event_details', description: 'Broadcast a specific event' },
      { command: 'broadcast_tasks', description: 'Broadcast available tasks (admin)' },
      { command: 'broadcast_custom', description: 'Send custom broadcast message (admin)' },
      { command: 'reset_quarter', description: 'Reset all commit counts to 0 (interactive, admin)' },
      { command: 'cancel', description: 'Cancel current operation' },
    ]);
    console.log('✅ Bot commands registered for auto-completion (webhook)');
  } catch (error) {
    console.error('❌ Failed to set bot commands (webhook):', error);
  }
};

// Create webhook handler for Vercel
export default async function handler(req: any, res: any) {
  console.log('Webhook called', req.method, req.headers);
  try {
    // Initialize bot if not already done
    if (!botInitialized) {
      await bot.init();
      await setupBotCommands();
      botInitialized = true;
    }

    if (req.method === 'POST') {
      // Process the Telegram update
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else {
      // Handle GET requests (for testing)
      res.status(200).json({ 
        message: 'WomenDevs SG Volunteer Bot is running!',
        bot: '@womendevssg_volunteer_bot'
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
