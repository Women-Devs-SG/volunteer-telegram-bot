import { Bot, Context, session, SessionFlavor } from 'grammy';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import command handlers
import { 
  onboardCommand, 
  myStatusCommand, 
  commitCommand,
  assignTaskCommand,
  updateTaskStatusCommand,
  monthlyReportCommand,
  volunteerStatusReportCommand
} from './commands/volunteers';

import { DrizzleDatabaseService } from './db-drizzle';

import { 
  requireAdmin,
  adminLoginCommand,
  listVolunteersCommand,
  addVolunteerCommand,
  removeVolunteerCommand,
  addVolunteerWithStatusCommand
} from './commands/admins';

import {
  broadcastCommand,
  broadcastVolunteersCommand,
  broadcastEventsCommand,
  broadcastTasksCommand,
  broadcastCustomCommand
} from './commands/broadcast';

import {
  createEventCommand,
  handleEventWizard,
  handleFinalizationConfirmation,
  finalizeEventCommand,
  listEventsCommand,
  eventDetailsCommand,
  cancelCommand
} from './commands/events';

import { processMonthlyVolunteerStatus, checkAndPromoteVolunteers } from './utils';
import { VolunteerScheduler } from './scheduler';

// Validate required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required. Please check your .env file.');
  process.exit(1);
}

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Create scheduler instance
const scheduler = new VolunteerScheduler(bot);

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Help message function
const getHelpMessage = async (telegramHandle?: string) => {
  let message = `🤖 **Volunteer Management Bot**

Welcome! I help manage volunteer onboarding, event planning, and admin tasks.

**For Volunteers:**
• \`/onboard\` - Learn about the volunteer program
• \`/my_status\` - Check your volunteer status
• \`/commit <task_id>\` - Sign up for event tasks
• \`/list_events\` - View upcoming events
• \`/event_details <event_id>\` - View detailed event information`;

  // Check if user is admin and add admin commands if they are
  if (telegramHandle) {
    const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
    
    if (isAdmin) {
      message += `

**For Admins:**
• \`/admin_login <secret>\` - Authenticate as admin
• \`/list_volunteers\` - View all volunteers
• \`/add_volunteer @handle "Name"\` - Add new volunteer
• \`/remove_volunteer @handle\` - Remove volunteer
• \`/add_volunteer_with_status @handle "Name" <status>\` - Add volunteer with status
• \`/create_event\` - Create new event (interactive with task selection)
• \`/assign_task <task_id> @volunteer\` - Assign tasks to volunteers
• \`/update_task_status <task_id> <status>\` - Update task status
• \`/monthly_report\` - Generate monthly volunteer status report
• \`/volunteer_status_report\` - View current volunteer status
• \`/broadcast\` - Show broadcast menu for testing
• \`/broadcast_volunteers\` - Broadcast volunteer status list
• \`/broadcast_events\` - Broadcast upcoming events
• \`/broadcast_tasks\` - Broadcast available tasks
• \`/broadcast_custom <message>\` - Send custom broadcast message
• \`/finalize_event <event_id>\` - Publish event`;
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
bot.command('my_status', myStatusCommand);
bot.command('commit', commitCommand);

// Admin authentication
bot.command('admin_login', adminLoginCommand);

// Admin commands (with authentication middleware)
bot.command('list_volunteers', requireAdmin, listVolunteersCommand);
bot.command('add_volunteer', requireAdmin, addVolunteerCommand);
bot.command('remove_volunteer', requireAdmin, removeVolunteerCommand);
bot.command('assign_task', requireAdmin, assignTaskCommand);
bot.command('add_volunteer_with_status', requireAdmin, addVolunteerWithStatusCommand);
bot.command('update_task_status', updateTaskStatusCommand);
bot.command('monthly_report', requireAdmin, monthlyReportCommand);
bot.command('volunteer_status_report', requireAdmin, volunteerStatusReportCommand);
bot.command('create_event', requireAdmin, createEventCommand);
bot.command('finalize_event', requireAdmin, finalizeEventCommand);
bot.command('list_events', listEventsCommand);
bot.command('event_details', eventDetailsCommand);

// Broadcast commands (admin only)
bot.command('broadcast', requireAdmin, broadcastCommand);
bot.command('broadcast_volunteers', requireAdmin, broadcastVolunteersCommand);
bot.command('broadcast_events', requireAdmin, broadcastEventsCommand);
bot.command('broadcast_tasks', requireAdmin, broadcastTasksCommand);
bot.command('broadcast_custom', requireAdmin, broadcastCustomCommand);

// Utility commands
bot.command('cancel', cancelCommand);

// Handle text messages for interactive wizards
bot.on('message:text', async (ctx) => {
  // Handle event creation wizard
  await handleEventWizard(ctx);
  
  // Handle finalization confirmation
  await handleFinalizationConfirmation(ctx);
});

// Periodic maintenance tasks
const runMaintenanceTasks = async () => {
  console.log('🔧 Running maintenance tasks...');
  
  try {
    // Check for volunteer promotions
    await checkAndPromoteVolunteers(bot);
    
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
  scheduler.stop();
  bot.stop();
});

process.once('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  scheduler.stop();
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
      { command: 'commit', description: 'Sign up for event tasks' },
      { command: 'admin_login', description: 'Authenticate as admin' },
      { command: 'list_volunteers', description: 'View all volunteers (admin)' },
      { command: 'add_volunteer', description: 'Add new volunteer (admin)' },
      { command: 'remove_volunteer', description: 'Remove volunteer (admin)' },
      { command: 'add_volunteer_with_status', description: 'Add volunteer with status (admin)' },
      { command: 'create_event', description: 'Create new event with task selection (admin)' },
      { command: 'assign_task', description: 'Assign tasks to volunteers (admin)' },
      { command: 'update_task_status', description: 'Update task status' },
      { command: 'monthly_report', description: 'Generate monthly volunteer status report (admin)' },
      { command: 'volunteer_status_report', description: 'View current volunteer status (admin)' },
      { command: 'finalize_event', description: 'Publish event (admin)' },
      { command: 'list_events', description: 'View upcoming events with tasks' },
      { command: 'event_details', description: 'View detailed event information' },
      { command: 'broadcast', description: 'Show broadcast menu (admin)' },
      { command: 'broadcast_volunteers', description: 'Broadcast volunteer status (admin)' },
      { command: 'broadcast_events', description: 'Broadcast upcoming events (admin)' },
      { command: 'broadcast_tasks', description: 'Broadcast available tasks (admin)' },
      { command: 'broadcast_custom', description: 'Send custom broadcast message (admin)' },
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
    
    // Set up command auto-completion
    await setupBotCommands();
    
    // Run initial maintenance check
    await runMaintenanceTasks();
    
    // Start the monthly scheduler
    scheduler.start();
    
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
