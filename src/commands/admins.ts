import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';
import { 
  formatVolunteerStatus, 
  validateTelegramHandle,
  parseDate,
  promoteIfEligible,
} from '../utils';
import { parseTopicLink } from '../parse-topic-link';

// Escape special characters for Telegram Markdown (v1) parse_mode
// Only escape characters that affect formatting to prevent visible backslashes
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]`])/g, '\\$1');
};

// Reset quarter interactive state
const resetQuarterState = new Map<number, { step: 'confirm' | 'end_date' }>();

// /reset_quarter command - interactive quarter reset (admin only)
export const resetQuarterCommand = async (ctx: CommandContext<Context>) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }
  resetQuarterState.set(userId, { step: 'confirm' });
  const warning = '⚠️ This will reset ALL volunteers\' commit counts to 0 and set a new commitment tracking period.\n\n' +
    'This action cannot be reversed.\n\n' +
    'Type `CONFIRM` to proceed, or `CANCEL` to abort.';
  await ctx.reply(warning, { parse_mode: 'Markdown' });
};

// Handle reset quarter wizard
export const handleResetQuarterWizard = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return;

  const state = resetQuarterState.get(userId);
  if (!state) return;

  if (text.toLowerCase() === 'cancel') {
    resetQuarterState.delete(userId);
    await ctx.reply('✅ Operation cancelled.');
    return;
  }

  switch (state.step) {
    case 'confirm': {
      if (text !== 'CONFIRM') {
        await ctx.reply('❌ Please type `CONFIRM` to proceed or `CANCEL` to abort.', { parse_mode: 'Markdown' });
        return;
      }
      state.step = 'end_date';
      await ctx.reply('📅 Please enter the end date for the commitment tracking quarter (e.g., `2025-03-31`).', { parse_mode: 'Markdown' });
      break;
    }
    case 'end_date': {
      const dateStr = text;
      const parsed = parseDate(dateStr);
      if (!parsed) {
        await ctx.reply('❌ Invalid date. Please enter a valid date (e.g., `2025-03-31`).', { parse_mode: 'Markdown' });
        return;
      }
      const result = await DrizzleDatabaseService.resetQuarterCommitments(parsed);
      resetQuarterState.delete(userId);
      if (result.success) {
        const nextStart = new Date(parsed.getTime() + 24*60*60*1000).toLocaleDateString();
        let msg = `✅ Commit counts reset to 0 for all volunteers.\n` +
                  `📅 New tracking period starts on ${nextStart}.\n`;
        if (result.inactivated.length > 0) {
          msg += `\n⚠️ The following volunteers were marked INACTIVE (had 0 commitments before reset):\n`;
          result.inactivated.forEach(v => {
            msg += `• ${v.name} (@${v.telegram_handle})\n`;
          });
          msg += `\n👉 Please remove these volunteers from the group and inform them about the change.`;
        }
        await ctx.reply(msg, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply('❌ Failed to reset commit counts. Please try again.');
      }
      break;
    }
  }
};

// /set_status command - update a volunteer's status (admin only)
export const setStatusCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ');

  if (!args || args.length !== 2) {
    await ctx.reply(
      '❌ **Usage:** `/set_status @handle <status>`\n\n' +
      '**Statuses:** probation, active, lead, inactive\n\n' +
      '**Example:** `/set_status @johndoe active`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const handleInput = args[0];
  const statusInput = (args?.[1] ?? '').toLowerCase();

  const validStatuses = ['probation', 'active', 'lead', 'inactive'] as const;
  if (!validStatuses.includes(statusInput as any)) {
    await ctx.reply(
      '❌ Invalid status. Use one of: probation, active, lead, inactive',
    );
    return;
  }

  const telegramHandle = validateTelegramHandle(handleInput || '');
  if (!telegramHandle) {
    await ctx.reply('❌ Invalid Telegram handle format.');
    return;
  }

  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  if (!volunteer) {
    await ctx.reply(`❌ Volunteer @${telegramHandle} not found.`);
    return;
  }

  const success = await DrizzleDatabaseService.updateVolunteerStatus(volunteer.id, statusInput as any);
  if (success) {
    const safeName = escapeMarkdown(volunteer.name);
    const safeHandle = escapeMarkdown(volunteer.telegram_handle);
    await ctx.reply(
      `✅ **Status updated!**\n\n` +
      `${safeName} (@${safeHandle}) is now **${statusInput.toUpperCase()}**.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to update volunteer status. Please try again.');
  }
};

// Conversation state for add_volunteer wizard
const addVolunteerState = new Map<number, {
  step: 'name' | 'handle' | 'status' | 'commitments';
  name?: string;
  handle?: string;
  status?: 'probation' | 'active' | 'lead' | 'inactive';
}>();

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
      const safeName = escapeMarkdown(volunteer.name);
      const safeHandle = escapeMarkdown(volunteer.telegram_handle);
      const start = new Date((volunteer as any).commit_count_start_date || volunteer.updated_at);
      const endText = (volunteer as any).probation_end_date ? new Date((volunteer as any).probation_end_date).toLocaleDateString() : 'present';
      message += `• ${safeName} (@${safeHandle}) - ${volunteer.commitments}/3 commitments (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
    });
    message += '\n';
  }

  if (activeVolunteers.length > 0) {
    message += '*🟢 Active Volunteers:*\n';
    activeVolunteers.forEach(volunteer => {
      const safeName = escapeMarkdown(volunteer.name);
      const safeHandle = escapeMarkdown(volunteer.telegram_handle);
      const start = new Date((volunteer as any).commit_count_start_date || volunteer.updated_at);
      const endText = (volunteer as any).probation_end_date ? new Date((volunteer as any).probation_end_date).toLocaleDateString() : 'present';
      message += `• ${safeName} (@${safeHandle}) - ${volunteer.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
    });
    message += '\n';
  }

  if (inactiveVolunteers.length > 0) {
    message += '*⚫ Inactive Volunteers:*\n';
    inactiveVolunteers.forEach(volunteer => {
      const safeName = escapeMarkdown(volunteer.name);
      const safeHandle = escapeMarkdown(volunteer.telegram_handle);
      const start = new Date((volunteer as any).commit_count_start_date || volunteer.updated_at);
      const endText = (volunteer as any).probation_end_date ? new Date((volunteer as any).probation_end_date).toLocaleDateString() : 'present';
      message += `• ${safeName} (@${safeHandle}) - ${volunteer.commitments} commitments (Tracking: ${start.toLocaleDateString()} → ${endText})\n`;
    });
    message += '\n';
  }

  if (leadVolunteers.length > 0) {
    message += '*⭐ Lead Volunteers:*\n';
    leadVolunteers.forEach(volunteer => {
      const safeName = escapeMarkdown(volunteer.name);
      const safeHandle = escapeMarkdown(volunteer.telegram_handle);
      message += `• ${safeName} (@${safeHandle}) - ${volunteer.commitments} commitments\n`;
    });
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
};

// /add_volunteer command - manually add a volunteer
export const addVolunteerCommand = async (ctx: CommandContext<Context>) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  addVolunteerState.set(userId, { step: 'name' });
  await ctx.reply(
    '👤 Please enter the volunteer\'s full name:',
    { parse_mode: 'Markdown' }
  );
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
    const safeName = escapeMarkdown(volunteer.name);
    const safeHandle = escapeMarkdown(volunteer.telegram_handle);
    await ctx.reply(
      `✅ **Volunteer removed successfully!**\n\n` +
      `${safeName} (@${safeHandle}) has been removed from the system.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to remove volunteer. Please try again.');
  }
};

// /add_volunteer_with_status command - manually add a volunteer with specific status
// Interactive wizard handler for add_volunteer
export const handleAddVolunteerWizard = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return;

  const state = addVolunteerState.get(userId);
  if (!state) return;

  switch (state.step) {
    case 'name': {
      if (text.length < 2) {
        await ctx.reply('❌ Please provide a valid name (at least 2 characters).');
        return;
      }
      state.name = text;
      state.step = 'handle';
      await ctx.reply('🔗 Please enter the volunteer\'s Telegram handle (e.g., @johndoe):');
      break;
    }
    case 'handle': {
      const handle = validateTelegramHandle(text || '');
      if (!handle) {
        await ctx.reply('❌ Invalid Telegram handle format. Handle should be 5-32 characters, alphanumeric and underscores only.');
        return;
      }
      // Check if exists
      const existing = await DrizzleDatabaseService.getVolunteerByHandle(handle);
      if (existing) {
        await ctx.reply(`❌ Volunteer @${handle} is already registered. Please enter a different handle.`);
        return;
      }
      state.handle = handle;
      state.step = 'status';
      await ctx.reply('🏷️ Enter status (probation, active, lead, inactive). Default: probation');
      break;
    }
    case 'status': {
      const input = text.toLowerCase();
      const valid: Array<'probation' | 'active' | 'lead' | 'inactive'> = ['probation','active','lead','inactive'];
      const status = valid.includes(input as any) ? (input as any) : 'probation';
      state.status = status;
      state.step = 'commitments';
      await ctx.reply('🔢 Enter commitment count (non-negative integer). Default: 0');
      break;
    }
    case 'commitments': {
      let count = 0;
      if (text !== '') {
        const n = parseInt(text);
        if (isNaN(n) || n < 0) {
          await ctx.reply('❌ Invalid number. Please enter a non-negative integer.');
          return;
        }
        count = n;
      }
      // Create volunteer with chosen status
      const v = await DrizzleDatabaseService.createVolunteerWithStatus(state.name!, state.handle!, state.status || 'probation');
      if (!v) {
        await ctx.reply('❌ Failed to add volunteer. Please try again.');
        addVolunteerState.delete(userId);
        return;
      }
      // Set commitments
      await DrizzleDatabaseService.setVolunteerCommitments(v.id, count);
      const finalVolunteer = { ...v, commitments: count } as any;
      await ctx.reply(
        `✅ **Volunteer added successfully!**\n\n` +
        formatVolunteerStatus(finalVolunteer),
        { parse_mode: 'Markdown' }
      );
      addVolunteerState.delete(userId);
      break;
    }
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

// /set_commit_count command - set a volunteer's commitment count directly (admin only)
export const setCommitCountCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ');

  if (!args || args.length !== 2) {
    await ctx.reply(
      '❌ **Usage:** `/set_commit_count @handle <count>`\n\n' +
      '**Example:** `/set_commit_count @johndoe 5`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const handleInput = args[0];
  const countStr = args[1];

  const telegramHandle = validateTelegramHandle(handleInput || '');
  if (!telegramHandle) {
    await ctx.reply('❌ Invalid Telegram handle format.');
    return;
  }

  const count = parseInt(countStr || '');
  if (isNaN(count) || count < 0) {
    await ctx.reply('❌ Invalid count. Please provide a non-negative number.');
    return;
  }

  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  if (!volunteer) {
    await ctx.reply(`❌ Volunteer @${telegramHandle} not found.`);
    return;
  }

  const success = await DrizzleDatabaseService.setVolunteerCommitments(volunteer.id, count);
  if (success) {
    const safeName = escapeMarkdown(volunteer.name);
    const safeHandle = escapeMarkdown(volunteer.telegram_handle);
    // Trigger promotion check immediately if they reached threshold while on probation
    const promoted = await promoteIfEligible(ctx.api as any, volunteer.id);
    let extra = '';
    if (promoted) {
      extra = `\n🚀 ${safeName} (@${safeHandle}) has been promoted to ACTIVE!`;
    }
    await ctx.reply(
      `✅ **Commit count updated!**\n\n` +
      `${safeName} (@${safeHandle}) now has ${count} commitments.` + extra,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to update commit count. Please try again.');
  }
};

// /remove_assignment command - remove a volunteer assignment from a task (admin only)
export const removeAssignmentCommand = async (ctx: CommandContext<Context>) => {
  const args = ctx.match?.toString().trim().split(' ');

  if (!args || args.length !== 2) {
    await ctx.reply(
      '❌ **Usage:** `/remove_assignment <task_id> @handle`\n\n' +
      '**Example:** `/remove_assignment 12 @johndoe`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const taskId = parseInt(args[0] || '');
  const handleInput = args[1];

  if (isNaN(taskId)) {
    await ctx.reply('❌ Invalid task ID. Please provide a valid number.');
    return;
  }

  const telegramHandle = validateTelegramHandle(handleInput || '');
  if (!telegramHandle) {
    await ctx.reply('❌ Invalid Telegram handle format.');
    return;
  }

  const volunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  if (!volunteer) {
    await ctx.reply(`❌ Volunteer @${telegramHandle} not found.`);
    return;
  }

  const task = await DrizzleDatabaseService.getTask(taskId);
  if (!task) {
    await ctx.reply('❌ Task not found.');
    return;
  }

  const success = await DrizzleDatabaseService.removeVolunteerFromTask(taskId, volunteer.id);
  if (success) {
    const safeName = escapeMarkdown(volunteer.name);
    const safeHandle = escapeMarkdown(volunteer.telegram_handle);
    const safeTaskTitle = escapeMarkdown(task.title);
    await ctx.reply(
      `✅ **Assignment removed!**\n\n` +
      `${safeName} (@${safeHandle}) has been removed from task "${safeTaskTitle}" (ID: ${task.id}).`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to remove assignment. Please try again.');
  }
};

// Removed duplicate erroneous setStatusCommand block
