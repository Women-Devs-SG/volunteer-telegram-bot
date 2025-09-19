import { Bot, webhookCallback } from 'grammy';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import command handlers
import { 
  onboardCommand, 
  myStatusCommand, 
  commitCommand 
} from '../src/commands/volunteers';

import { 
  requireAdmin,
  adminLoginCommand,
  listVolunteersCommand,
  addVolunteerCommand,
  removeVolunteerCommand,
} from '../src/commands/admins';

import { 
  createEventCommand,
  handleEventWizard,
  listEventsCommand,
  eventDetailsCommand,
  cancelCommand
} from '../src/commands/events';

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

// Start command
bot.command('start', async (ctx) => {
  const welcomeMessage = `🤖 **Volunteer Management Bot**

Welcome! I help manage volunteer onboarding, event planning, and admin tasks.

**For Volunteers:**
• \`/onboard\` - Learn about the volunteer program
• \`/my_status\` - Check your volunteer status
• \`/commit <event_id> <role>\` - Sign up for event roles

**For Admins:**
• \`/admin_login <secret>\` - Authenticate as admin
• \`/list_volunteers\` - View all volunteers
• \`/add_volunteer @handle "Name"\` - Add new volunteer
• \`/remove_volunteer @handle\` - Remove volunteer
• \`/create_event\` - Create new event (interactive)
• \`/assign_role <event_id> <role> @volunteer\` - Assign roles
• \`/finalize_event <event_id>\` - Publish event
• \`/list_events\` - View all events
• \`/event_details <event_id>\` - View event details

**General:**
• \`/help\` - Show this help message
• \`/cancel\` - Cancel current operation

Let's get started! 🚀`;

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
});

// Help command
bot.command('help', async (ctx) => {
  await bot.handleUpdate({
    update_id: 0,
    message: {
      message_id: 0,
      date: 0,
      chat: ctx.chat,
      from: ctx.from,
      text: '/start'
    }
  } as any);
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
bot.command('create_event', requireAdmin, createEventCommand);
bot.command('list_events', requireAdmin, listEventsCommand);
bot.command('event_details', requireAdmin, eventDetailsCommand);

// Utility commands
bot.command('cancel', cancelCommand);

// Handle text messages for interactive wizards
bot.on('message:text', async (ctx) => {
  // Handle event creation wizard
  await handleEventWizard(ctx);
});

// Initialize bot once
let botInitialized = false;

// Create webhook handler for Vercel
export default async function handler(req: any, res: any) {
  console.log('Webhook called', req.method, req.headers);
  try {
    // Initialize bot if not already done
    if (!botInitialized) {
      await bot.init();
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
