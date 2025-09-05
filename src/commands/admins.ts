import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';
import { 
  formatVolunteerStatus, 
  validateTelegramHandle,
} from '../utils';
import { parseTopicLink } from '../parse-topic-link';

// Admin authentication middleware
export const requireAdmin = async (ctx: CommandContext<Context>, next: () => Promise<void>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use admin commands.');
    return;
  }

  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  
  if (!isAdmin) {
    await ctx.reply('❌ You are not authorized to use admin commands.');
    return;
  }

  await next();
};

// /admin_login command - authenticate as admin
export const adminLoginCommand = async (ctx: CommandContext<Context>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this command.');
    return;
  }

  const secret = ctx.match?.toString().trim();
  const adminSecret = process.env.ADMIN_SECRET;

  if (!secret) {
    await ctx.reply('❌ **Usage:** `/admin_login <secret>`', { parse_mode: 'Markdown' });
    return;
  }

  if (!adminSecret || secret !== adminSecret) {
    await ctx.reply('❌ Invalid admin secret.');
    return;
  }

  // Check if already admin
  const isAlreadyAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  
  if (isAlreadyAdmin) {
    await ctx.reply('✅ You are already registered as an admin.');
    return;
  }

  // Add as admin
  const success = await DrizzleDatabaseService.addAdmin(telegramHandle);
  
  if (success) {
    await ctx.reply('✅ **Admin access granted!** You can now use admin commands.', { parse_mode: 'Markdown' });
  } else {
    await ctx.reply('❌ Failed to register as admin. Please try again.');
  }
};

// /list_volunteers command - list all volunteers with their status
export const listVolunteersCommand = async (ctx: CommandContext<Context>) => {
  const volunteers = await DrizzleDatabaseService.getAllVolunteers();
  
  if (volunteers.length === 0) {
    await ctx.reply('📋 No volunteers registered yet.');
    return;
  }

  let message = '📋 *All Volunteers:*\n\n';
  
  // Group volunteers by status
  const probationVolunteers = volunteers.filter(v => v.status === 'probation');
  const activeVolunteers = volunteers.filter(v => v.status === 'active');
  const leadVolunteers = volunteers.filter(v => v.status === 'lead');
  const inactiveVolunteers = volunteers.filter(v => v.status === 'inactive');

  if (probationVolunteers.length > 0) {
    message += '*🟡 Probation Volunteers:*\n';
    probationVolunteers.forEach(volunteer => {
      const escapedName = volunteer.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      const escapedHandle = volunteer.telegram_handle.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      message += `• ${escapedName} (@${escapedHandle}) \\- ${volunteer.commitments}/3 commitments\n`;
    });
    message += '\n';
  }

  if (activeVolunteers.length > 0) {
    message += '*🟢 Active Volunteers:*\n';
    activeVolunteers.forEach(volunteer => {
      const escapedName = volunteer.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      const escapedHandle = volunteer.telegram_handle.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      message += `• ${escapedName} (@${escapedHandle}) \\- ${volunteer.commitments} commitments\n`;
    });
    message += '\n';
  }

  if (inactiveVolunteers.length > 0) {
    message += '*⚫ Inactive Volunteers:*\n';
    inactiveVolunteers.forEach(volunteer => {
      const escapedName = volunteer.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      const escapedHandle = volunteer.telegram_handle.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      message += `• ${escapedName} (@${escapedHandle}) \\- ${volunteer.commitments} commitments\n`;
    });
    message += '\n';
  }

  if (leadVolunteers.length > 0) {
    message += '*⭐ Lead Volunteers:*\n';
    leadVolunteers.forEach(volunteer => {
      const escapedName = volunteer.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      const escapedHandle = volunteer.telegram_handle.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      message += `• ${escapedName} (@${escapedHandle}) \\- ${volunteer.commitments} commitments\n`;
    });
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
};

// /add_volunteer command - manually add a volunteer
export const addVolunteerCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ');
  
  if (!args || args.length < 2) {
    await ctx.reply(
      '❌ **Usage:** `/add_volunteer @handle "Full Name"`\n\n' +
      '**Example:** `/add_volunteer @johndoe "John Doe"`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const handleInput = args[0];
  const name = args.slice(1).join(' ').replace(/"/g, ''); // Remove quotes if present

  // Validate telegram handle
  const telegramHandle: string | null = validateTelegramHandle(handleInput || '');
  
  if (!telegramHandle) {
    await ctx.reply('❌ Invalid Telegram handle format. Handle should be 5-32 characters, alphanumeric and underscores only.');
    return;
  }

  if (!name || name.length < 2) {
    await ctx.reply('❌ Please provide a valid name (at least 2 characters).');
    return;
  }

  // Check if volunteer already exists
  const existingVolunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  
  if (existingVolunteer) {
    await ctx.reply(`❌ Volunteer @${telegramHandle} is already registered.`);
    return;
  }

  // Create new volunteer
  const newVolunteer = await DrizzleDatabaseService.createVolunteer(name, telegramHandle);
  
  if (newVolunteer) {
    await ctx.reply(
      `✅ **Volunteer added successfully!**\n\n` +
      `Name: ${newVolunteer.name}\n` +
      `Handle: @${newVolunteer.telegram_handle}\n` +
      `Status: ${newVolunteer.status}\n` +
      `Probation started: ${new Date(newVolunteer.probation_start_date).toLocaleDateString()}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to add volunteer. Please try again.');
  }
};

// /remove_volunteer command - remove volunteer
export const removeVolunteerCommand = async (ctx: CommandContext<Context>) => {
  const handleInput = ctx.match?.toString().trim();
  
  if (!handleInput) {
    await ctx.reply(
      '❌ **Usage:** `/remove_volunteer @handle`\n\n' +
      '**Example:** `/remove_volunteer @johndoe`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Validate telegram handle
  const telegramHandle = validateTelegramHandle(handleInput);
  
  if (!telegramHandle) {
    await ctx.reply('❌ Invalid Telegram handle format.');
    return;
  }

  // Check if volunteer exists
  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  
  if (!volunteer) {
    await ctx.reply(`❌ Volunteer @${telegramHandle} not found.`);
    return;
  }

  // Remove volunteer
  const success = await DrizzleDatabaseService.removeVolunteer(telegramHandle);
  
  if (success) {
    await ctx.reply(
      `✅ **Volunteer removed successfully!**\n\n` +
      `${volunteer.name} (@${volunteer.telegram_handle}) has been removed from the system.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to remove volunteer. Please try again.');
  }
};

// /add_volunteer_with_status command - manually add a volunteer with specific status
export const addVolunteerWithStatusCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ');
  
  if (!args || args.length < 3) {
    await ctx.reply(
      '❌ **Usage:** `/add_volunteer_with_status @handle "Full Name" <status>`\n\n' +
      '**Available statuses:** probation, active, lead, inactive\n\n' +
      '**Example:** `/add_volunteer_with_status @johndoe "John Doe" active`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const handleInput = args[0];
  const status = args[args.length - 1] as 'probation' | 'active' | 'lead' | 'inactive';
  const name = args.slice(1, -1).join(' ').replace(/"/g, ''); // Remove quotes if present

  // Validate status
  const validStatuses = ['probation', 'active', 'lead', 'inactive'];
  if (!validStatuses.includes(status)) {
    await ctx.reply('❌ Invalid status. Use: probation, active, lead, or inactive');
    return;
  }

  // Validate telegram handle
  const telegramHandle: string | null = validateTelegramHandle(handleInput || '');
  
  if (!telegramHandle) {
    await ctx.reply('❌ Invalid Telegram handle format. Handle should be 5-32 characters, alphanumeric and underscores only.');
    return;
  }

  if (!name || name.length < 2) {
    await ctx.reply('❌ Please provide a valid name (at least 2 characters).');
    return;
  }

  // Check if volunteer already exists
  const existingVolunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  
  if (existingVolunteer) {
    await ctx.reply(`❌ Volunteer @${telegramHandle} is already registered.`);
    return;
  }

  // Create new volunteer with specified status
  const newVolunteer = await DrizzleDatabaseService.createVolunteerWithStatus(name, telegramHandle, status);
  
  if (newVolunteer) {
    await ctx.reply(
      `✅ **Volunteer added successfully!**\n\n` +
      formatVolunteerStatus(newVolunteer),
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to add volunteer. Please try again.');
  }
};

// Handler function for tests
export const handleListVolunteersCommand = async (ctx: CommandContext<Context>) => {
  const telegramHandle = ctx.from?.username;
  
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this command.');
    return;
  }

  // Check if user is admin
  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  if (!isAdmin) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  await listVolunteersCommand(ctx);
};
