import { Bot, Context, session, SessionFlavor } from 'grammy';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Global error handlers for better diagnostics
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('UnhandledPromiseRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
  // Do not exit immediately during dev to aid debugging
});

// Import command handlers
import { 
  onboardCommand, 
  handleOnboardCallback,
  myStatusCommand,
  myTasksCommand, 
  commitCommand,
  uncommitCommand,
  assignTaskCommand,
  updateTaskStatusCommand,
  volunteerStatusReportCommand,
} from './commands/volunteers';

import { DrizzleDatabaseService } from './db-drizzle';

import { 
  requireAdmin,
  adminLoginCommand,
  listVolunteersCommand,
  addVolunteerCommand,
  removeVolunteerCommand,
  handleAddVolunteerWizard,
  setCommitCountCommand,
  setStatusCommand,
  removeAssignmentCommand,
  resetQuarterCommand,
  handleResetQuarterWizard,
  removeAdminCommand
} from './commands/admins';

import { 
  broadcastCommand,
  broadcastVolunteersCommand,
  broadcastEventsCommand,
  broadcastTasksCommand,
  broadcastCustomCommand,
  broadcastEventDetailsCommand,
  handleBroadcastEventDetailsConfirmation
} from './commands/broadcast';

import { ensureDbReady } from './drizzle';
import { 
  createEventCommand,
  editEventCommand,
  eventDetailsCommand,
  handleEditEventWizard,
  handleEventWizard,
  handleRemoveEventConfirmation,
  listEventsCommand,
  removeEventCommand,
  cancelCommand
} from './commands/events';
import { loggedAdminCommand } from './middleware/loggedAdminCommand';
import { auditLogsCommand } from './commands/adminAuditLogs';

// Removed monthly processing utilities and scheduler (no auto scheduling)

// Validate required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required. Please check your .env file.');
  process.exit(1);
}

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Scheduler removed by design; no automatic scheduling

// Error handling with user-friendly notification
bot.catch(async (err) => {
  console.error('Bot error:', err);
  const ctx = (err as any).ctx as Context | undefined;
  if (ctx) {
    try {
      await ctx.reply(
        '⚠️ An unexpected error occurred while processing your request. Please try again.\n\n' +
          'If this keeps happening, please notify an admin or open an issue on our GitHub repo:\n' +
          'https://github.com/Women-Devs-SG/volunteer-telegram-bot/issues',
      );
    } catch (sendErr) {
      console.error('Failed to send error notification to user:', sendErr);
    }
  }
});

// Help message function
const getHelpMessage = async (telegramHandle?: string) => {
  let message = `🤖 **Volunteer Management Bot**

Welcome! I help manage volunteer onboarding, event planning, and admin tasks.

**For Volunteers:**
• \`/onboard\` - Learn about the volunteer program
• \`/my_status\` - Check your volunteer status
• \`/my_tasks\` - View your assigned tasks
• \`/commit <task_id>\` - Sign up for event tasks
• \`/uncommit <task_id>\` - Remove yourself from a task
• \`/list_events\` - View upcoming events
• \`/event_details <event_id>\` - View detailed event information
• \`/create_event\` - Create a new event (interactive)
• \`/edit_event <event_id>\` - Edit your own event (admins can edit any)`;

  // Check if user is admin and add admin commands if they are
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
bot.command('my_tasks', myTasksCommand);
bot.command('commit', commitCommand);
bot.command('uncommit', uncommitCommand);


// Admin authentication
bot.command('admin_login', adminLoginCommand);

// Admin commands (with authentication middleware and logging)
bot.command('audit_logs', requireAdmin, loggedAdminCommand('audit_logs', auditLogsCommand));
bot.command('list_volunteers', requireAdmin, loggedAdminCommand('list_volunteers', listVolunteersCommand));
bot.command('add_volunteer', requireAdmin, loggedAdminCommand('add_volunteer', addVolunteerCommand));
bot.command('remove_volunteer', requireAdmin, loggedAdminCommand('remove_volunteer', removeVolunteerCommand));
bot.command('assign_task', requireAdmin, loggedAdminCommand('assign_task', assignTaskCommand));
bot.command('update_task_status', requireAdmin, loggedAdminCommand('update_task_status', updateTaskStatusCommand));
bot.command('remove_assignment', requireAdmin, loggedAdminCommand('remove_assignment', removeAssignmentCommand));
bot.command('remove_admin', requireAdmin, loggedAdminCommand('remove_admin', removeAdminCommand));
bot.command('set_commit_count', requireAdmin, loggedAdminCommand('set_commit_count', setCommitCountCommand));
bot.command('set_status', requireAdmin, loggedAdminCommand('set_status', setStatusCommand));
bot.command('reset_quarter', requireAdmin, loggedAdminCommand('reset_quarter', resetQuarterCommand));
bot.command('volunteer_status_report', requireAdmin, loggedAdminCommand('volunteer_status_report', volunteerStatusReportCommand));
bot.command('create_event', loggedAdminCommand('create_event', createEventCommand));
bot.command('edit_event', loggedAdminCommand('edit_event', editEventCommand));
bot.command('list_events', loggedAdminCommand('list_events', listEventsCommand));
bot.command('event_details', loggedAdminCommand('event_details', eventDetailsCommand));
bot.command('remove_event', requireAdmin, loggedAdminCommand('remove_event', removeEventCommand));

// Broadcast commands (admin only)
bot.command('broadcast', requireAdmin, loggedAdminCommand('broadcast', broadcastCommand));
bot.command('broadcast_volunteers', requireAdmin, loggedAdminCommand('broadcast_volunteers', broadcastVolunteersCommand));
bot.command('broadcast_events', requireAdmin, loggedAdminCommand('broadcast_events', broadcastEventsCommand));
bot.command('broadcast_event_details', loggedAdminCommand('broadcast_event_details', broadcastEventDetailsCommand));
bot.command('broadcast_tasks', requireAdmin, loggedAdminCommand('broadcast_tasks', broadcastTasksCommand));
bot.command('broadcast_custom', requireAdmin, loggedAdminCommand('broadcast_custom', broadcastCustomCommand));

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

// Periodic maintenance tasks
const runMaintenanceTasks = async () => {
  console.log('🔧 Running maintenance tasks...');
  
  try {
    // Add maintenance tasks here if needed (promotion scan removed by design)
    console.log('✅ Maintenance tasks completed');
  } catch (error) {
    console.error('❌ Error running maintenance tasks:', error);
  }
};

// Run maintenance tasks every hour
setInterval(runMaintenanceTasks, 60 * 60 * 1000);

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  bot.stop();
});

process.once('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  bot.stop();
});

// Set up bot commands for auto-completion
const setupBotCommands = async () => {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Show welcome message and help' },
      { command: 'help', description: 'Show all available commands' },
      { command: 'onboard', description: 'Learn about the volunteer program' },
      { command: 'my_status', description: 'Check your volunteer status' },
      { command: 'my_tasks', description: 'View your assigned tasks' },
      { command: 'commit', description: 'Sign up for event tasks' },
      { command: 'uncommit', description: 'Remove yourself from event tasks' },
      { command: 'admin_login', description: 'Authenticate as admin' },
      { command: 'list_volunteers', description: 'View all volunteers (admin)' },
      { command: 'add_volunteer', description: 'Add new volunteer (interactive, admin)' },
      { command: 'remove_volunteer', description: 'Remove volunteer (admin)' },
      { command: 'remove_admin', description: 'Remove admin access from a handle (admin)' },
      { command: 'create_event', description: 'Create new event with task selection' },
      { command: 'edit_event', description: 'Edit an event details/tasks (own events for non-admins)' },
      { command: 'assign_task', description: 'Assign tasks to volunteers (admin)' },
      { command: 'update_task_status', description: 'Update task status (admin)' },
      { command: 'remove_assignment', description: 'Remove a volunteer from a task (admin)' },
      { command: 'set_commit_count', description: 'Overwrite a volunteer\'s commit count (admin)' },
      { command: 'set_status', description: 'Update a volunteer\'s status (admin)' },
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
      { command: 'cancel', description: 'Cancel current operation' }
    ]);
    console.log('✅ Bot commands registered for auto-completion');
  } catch (error) {
    console.error('❌ Failed to set bot commands:', error);
  }
};

// Start the bot
const startBot = async () => {
  try {
    console.log('🚀 Starting Telegram Volunteer Bot...');
    console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);

    // Ensure database is ready (forces PGlite init in dev)
    await ensureDbReady();
    
    // Set up command auto-completion
    await setupBotCommands();
    
    // Run initial maintenance check
    await runMaintenanceTasks();
    
    // Start polling for updates
    await bot.start();
    
    console.log('✅ Bot is running successfully!');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
};

// Start the bot
startBot();
