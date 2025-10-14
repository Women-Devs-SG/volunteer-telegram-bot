import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';
import { Event } from '../types';
import { 
  parseDate, 
  formatEventDetails,
  TBD_DATE_ISO,
  isTbdDateIso,
  formatHumanDate
} from '../utils';

import { getRequiredTasks, getAllTaskTemplates, formatTaskTemplatesForSelection } from '../utils/task-templates';

// Store conversation state for interactive wizards
const conversationState = new Map<number, any>();
const editEventState = new Map<number, {
  step: 'await_id' | 'menu' | 'field_value' | 'add_task_title' | 'add_task_desc' | 'remove_task' | 'update_task_status_task' | 'update_task_status_value';
  eventId?: number;
  field?: 'title' | 'date' | 'format' | 'venue' | 'details' | 'status';
  pendingTask?: { title: string; description?: string };
}>();

// Store state for remove_event confirmation
const removeEventState = new Map<number, { eventId: number }>();

// /create_event command - interactive wizard
export const createEventCommand = async (ctx: CommandContext<Context>) => {
  const userId = ctx.from?.id;
  const telegramHandle = ctx.from?.username;
  
  if (!userId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  if (!telegramHandle) {
    await ctx.reply('❌ Unable to identify your Telegram handle. Please set a username.');
    return;
  }

  // Ensure we have a volunteer record for the creator
  let creator = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);
  if (!creator) {
    // Create a placeholder volunteer record for this handle
    creator = await DrizzleDatabaseService.createVolunteer(telegramHandle, telegramHandle, 'probation');
  }

  // Initialize conversation state and stash creator id
  conversationState.set(userId, { step: 'title', createdBy: creator?.id });
  
  await ctx.reply(
    '🎯 **Event Creation Wizard**\n\n' +
    'Let\'s create a new event! I\'ll guide you through the process.\n\n' +
    '**Step 1/6:** What is the event title?',
    { parse_mode: 'Markdown' }
  );
};

// /edit_event <event_id> - interactive editor
export const editEventCommand = async (ctx: CommandContext<Context>) => {
  const userId = ctx.from?.id;
  const telegramHandle = ctx.from?.username;
  if (!userId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }
  if (!telegramHandle) {
    await ctx.reply('❌ Unable to identify your Telegram handle. Please set a username.');
    return;
  }

  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  const currentVolunteer = await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle);

  const arg = ctx.match?.toString().trim();
  let eventId: number | null = null;
  if (arg) {
    const n = parseInt(arg, 10);
    if (!isNaN(n)) {
      eventId = n;
    }
  }
  editEventState.set(userId, { step: 'await_id' });
  if (!eventId) {
    await ctx.reply('✏️ Please provide the event ID to edit (usage: `/edit_event <event_id>`).', { parse_mode: 'Markdown' });
    return;
  }

  // Verify event exists
  const event = await DrizzleDatabaseService.getEvent(eventId);
  if (!event) {
    await ctx.reply('❌ Event not found.');
    editEventState.delete(userId);
    return;
  }
  // Permission: admins can edit all; non-admins only if they created it
  if (!isAdmin) {
    if (!currentVolunteer || event.created_by !== currentVolunteer.id) {
      await ctx.reply('❌ You can only edit events you created.');
      return;
    }
  }
  editEventState.set(userId, { step: 'menu', eventId });
  await ctx.reply(
    `<b>Edit Event</b>\n` +
    `ID: ${event.id} — ${event.title}\n\n` +
    'Reply with one of the following options:\n' +
    '• title\n' +
    '• date (YYYY-MM-DD or TBD)\n' +
    '• format (talk/workshop/...)\n' +
    '• venue\n' +
    '• details\n' +
    '• status (planning/published/completed/cancelled)\n' +
    '• <code>add_task</code> \n' +
    '• <code>remove_task</code> \n' +
    '• <code>update_task_status</code> \n' +
    '• done\n' +
    '• cancel',
    { parse_mode: 'HTML' }
  );
};

export const handleEditEventWizard = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return;
  const state = editEventState.get(userId);
  if (!state) return;

  if (text.toLowerCase() === 'cancel') {
    editEventState.delete(userId);
    await ctx.reply('✅ Edit cancelled.');
    return;
  }
  if (text.toLowerCase() === 'done') {
    if (state.eventId) {
      const ev = await DrizzleDatabaseService.getEvent(state.eventId);
      const tasks = await DrizzleDatabaseService.getEventTasks(state.eventId);
      if (ev) {
        const details = await formatEventDetails(ev, tasks);
        await ctx.reply(`✅ Edit complete.\n\n${details}`, { parse_mode: 'HTML' });
      }
    }
    editEventState.delete(userId);
    return;
  }

  switch (state.step) {
    case 'await_id': {
      // If user typed /edit_event without id, allow entering here
      const n = parseInt(text, 10);
      if (isNaN(n)) {
        await ctx.reply('❌ Please provide a valid numeric event ID or type `cancel`.');
        return;
      }
      const ev = await DrizzleDatabaseService.getEvent(n);
      if (!ev) {
        await ctx.reply('❌ Event not found. Please provide a valid event ID.');
        return;
      }
      // Permission check for non-admins
      const telegramHandle = ctx.from?.username;
      const isAdmin = telegramHandle ? await DrizzleDatabaseService.isAdmin(telegramHandle) : false;
      if (!isAdmin) {
        const me = telegramHandle ? await DrizzleDatabaseService.getVolunteerByHandle(telegramHandle) : null;
        if (!me || ev.created_by !== me.id) {
          await ctx.reply('❌ You can only edit events you created.');
          return;
        }
      }
      state.eventId = n;
      state.step = 'menu';
      await ctx.reply(
        `<b>Edit Event</b>\n` +
        `ID: ${ev.id} — ${ev.title}\n\n` +
        'Reply with one of: title, date, format, venue, details, status, <code>add_task</code>, <code>remove_task</code>, <code>update_task_status</code>, done, cancel',
        { parse_mode: 'HTML' }
      );
      break;
    }
    case 'menu': {
      const choice = text.toLowerCase();
      if (['title','date','format','venue','details','status'].includes(choice)) {
        state.field = choice as any;
        state.step = 'field_value';
        if (choice === 'date') {
          await ctx.reply('Please enter new value for date (YYYY-MM-DD or type "TBD" to set as unknown, or type "skip" to leave unchanged).');
        } else {
          await ctx.reply(`Please enter new value for ${choice}.`);
        }
        return;
      }
      if (choice === 'add_task') {
        state.step = 'add_task_title';
        await ctx.reply('🆕 Enter task title to add:');
        return;
      }
      if (choice === 'remove_task') {
        state.step = 'remove_task';
        const tasks = await DrizzleDatabaseService.getEventTasks(state.eventId!);
        if (tasks.length === 0) {
          await ctx.reply('No tasks to remove for this event.');
        } else {
          let msg = 'Type the Task ID to remove. Existing tasks:\n';
          tasks.forEach(t => { msg += `• ${t.title} (ID: ${t.id})\n`; });
          await ctx.reply(msg);
        }
        return;
      }
      if (choice === 'update_task_status') {
        state.step = 'update_task_status_task';
        const tasks = await DrizzleDatabaseService.getEventTasks(state.eventId!);
        if (tasks.length === 0) {
          await ctx.reply('There are no tasks for this event yet.');
          state.step = 'menu';
        } else {
          let msg = 'Enter: <task_id> <status>\n';
          msg += 'Status options: todo | in_progress | complete\n\n';
          msg += 'Existing tasks:\n';
          tasks.forEach(t => { msg += `• ${t.title} (ID: ${t.id})\n`; });
          await ctx.reply(msg);
        }
        return;
      }
      await ctx.reply('❌ Invalid option. Choose: title, date, format, venue, details, status, add\_task, remove\_task, update\_task\_status, done, cancel');
      break;
    }
    case 'field_value': {
      const field = state.field!;
      const fields: any = {};
      if (field === 'date') {
        const lower = text.toLowerCase();
        if (lower === 'skip') {
          await ctx.reply('↩️ No changes made to date. Type another option or `done`.');
          state.step = 'menu';
          break;
        }
        if (lower === 'tbd') {
          fields.date = TBD_DATE_ISO;
        } else {
          const d = parseDate(text);
          if (!d) {
            await ctx.reply('❌ Invalid date. Please use YYYY-MM-DD, or type "TBD" to set as unknown.');
            return;
          }
          fields.date = d.toISOString();
        }
      } else if (field === 'status') {
        const statusInput = text.toLowerCase();
        const validStatuses: Array<'planning' | 'published' | 'completed' | 'cancelled'> = ['planning','published','completed','cancelled'];
        if (!validStatuses.includes(statusInput as any)) {
          await ctx.reply('❌ Invalid status. Use one of: planning, published, completed, cancelled');
          return;
        }
        const ok = await DrizzleDatabaseService.updateEventStatus(state.eventId!, statusInput as any);
        if (ok) {
          await ctx.reply('✅ Status updated. Type another option (title/date/format/venue/details/status/add\_task/remove\_task) or `done`/`cancel`.');
          state.step = 'menu';
        } else {
          await ctx.reply('❌ Failed to update status. Try again.');
        }
        break;
      } else if (field === 'format') {
        fields.format = text.toLowerCase().replace(/\s+/g,'_');
      } else if (field === 'venue') {
        fields.venue = text.toLowerCase() === 'null' ? null : text;
      } else if (field === 'details') {
        fields.details = text.toLowerCase() === 'skip' ? undefined : text;
      } else if (field === 'title') {
        fields.title = text;
      }
      const ok = await DrizzleDatabaseService.updateEventFields(state.eventId!, fields);
      if (ok) {
        await ctx.reply('✅ Field updated. Type another option (title/date/format/venue/details/status/add\_task/remove\_task) or `done`/`cancel`.');
        state.step = 'menu';
      } else {
        await ctx.reply('❌ Failed to update field. Try again.');
      }
      break;
    }
    case 'add_task_title': {
      state.pendingTask = { title: text };
      state.step = 'add_task_desc';
      await ctx.reply('Enter task description (or type `skip`):');
      break;
    }
    case 'add_task_desc': {
      const desc = text.toLowerCase() === 'skip' ? undefined : text;
      const created = await DrizzleDatabaseService.createTask(state.eventId!, state.pendingTask!.title, desc);
      if (created) {
        await ctx.reply(`✅ Task created: ${created.title} (ID: ${created.id}). Type next option or \'done\'.`);
      } else {
        await ctx.reply('❌ Failed to create task.');
      }
      state.pendingTask = undefined;
      state.step = 'menu';
      break;
    }
    case 'remove_task': {
      const taskId = parseInt(text, 10);
      if (isNaN(taskId)) {
        await ctx.reply('❌ Please provide a valid Task ID to remove.');
        return;
      }
      const ok = await DrizzleDatabaseService.deleteTask(taskId);
      if (ok) {
        await ctx.reply('✅ Task removed. Type next option or `done`.');
      } else {
        await ctx.reply('❌ Failed to remove task.');
      }
      state.step = 'menu';
      break;
    }
    case 'update_task_status_task': {
      // Accept either "<task_id> <status>" in one go, or just the id first
      const parts = text.split(/\s+/);
      const taskId = parseInt(parts[0] || '', 10);
      if (isNaN(taskId)) {
        await ctx.reply('❌ Please provide a valid Task ID. Example: `12 in_progress`', { parse_mode: 'Markdown' });
        return;
      }
      let status: 'todo' | 'in_progress' | 'complete' | undefined;
      if (parts[1]) {
        const s = parts[1] as any;
        if (['todo','in_progress','complete'].includes(s)) status = s;
      }
      if (!status) {
        state.pendingTask = { title: String(taskId) };
        state.step = 'update_task_status_value';
        await ctx.reply('Enter new status for the task (todo | in_progress | complete):');
      } else {
        const ok = await DrizzleDatabaseService.updateTaskStatus(taskId, status);
        if (ok) {
          await ctx.reply('✅ Task status updated. Type another option or `done`.');
          state.step = 'menu';
        } else {
          await ctx.reply('❌ Failed to update task status. Please check the Task ID and try again.');
        }
      }
      break;
    }
    case 'update_task_status_value': {
      const taskIdStr = state.pendingTask?.title || '';
      const taskId = parseInt(taskIdStr, 10);
      const s = text.trim() as any;
      if (!['todo','in_progress','complete'].includes(s)) {
        await ctx.reply('❌ Invalid status. Use one of: todo | in_progress | complete');
        return;
      }
      const ok = await DrizzleDatabaseService.updateTaskStatus(taskId, s);
      if (ok) {
        await ctx.reply('✅ Task status updated. Type another option or `done`.');
        state.step = 'menu';
      } else {
        await ctx.reply('❌ Failed to update task status. Please check the Task ID and try again.');
      }
      state.pendingTask = undefined;
      break;
    }
  }
};

// Handle event creation wizard responses
export const handleEventWizard = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;
  
  if (!userId || !text || !conversationState.has(userId)) {
    return;
  }

  const state = conversationState.get(userId);
  
  switch (state.step) {
    case 'title':
      state.title = text;
      state.step = 'date';
      await ctx.reply(
        '**Step 2/6:** When is the event?\n\n' +
        'Please provide the date in one of these formats:\n' +
        '• YYYY-MM-DD (e.g., 2024-03-15)\n' +
        '• DD/MM/YYYY (e.g., 15/03/2024)\n' +
        '• Natural language (e.g., "next Friday", "March 15th")\n' +
        '• Or type "TBD" if the date is not confirmed yet',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'date':
      {
        const lower = text.toLowerCase();
        if (lower === 'tbd' || lower === 'skip') {
          state.date = TBD_DATE_ISO;
        } else {
          const parsedDate = parseDate(text);
          if (!parsedDate) {
            await ctx.reply('❌ Invalid date format. Please try again with a valid date or type "TBD".');
            return;
          }
          state.date = parsedDate.toISOString();
        }
      }
      state.step = 'format';
      await ctx.reply(
        '**Step 3/6:** What is the event format?\n\n' +
        'Please choose one:\n' +
        '• `talk` - Single speaker presentation\n' +
        '• `workshop` - Interactive learning session\n' +
        '• `moderated_discussion` - Facilitated discussion\n' +
        '• `conference` - Large-scale conference\n' +
        '• `hangout` - Casual social gathering\n' +
        '• `meeting` - Formal meeting\n' +
        '• `external_speaker` - Event with external speaker\n' +
        '• `newsletter` - Newsletter content creation\n' +
        '• `social_media_campaign` - Social media campaign\n' +
        '• `coding_project` - Open-source or internal coding project\n' +
        '• `others` - Other event type\n\n' +
        'Type the format name (e.g., "workshop")',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'format':
      const format = text.toLowerCase().replace(/\s+/g, '_') as Event['format'];
      const validFormats = ['workshop', 'panel', 'conference', 'talk', 'hangout', 'meeting', 
                           'external_speaker', 'newsletter', 'social_media_campaign', 'coding_project',
                           'moderated_discussion', 'others'];
      
      if (!validFormats.includes(format)) {
        await ctx.reply('❌ Invalid format. Please choose from the available options.');
        return;
      }
      
      state.format = format;
      state.step = 'venue';
      await ctx.reply(
        '**Step 4/6:** What is the venue for this event?\n\n' +
        'You can provide a venue name/address, or type "TBD" if not confirmed yet, or "skip" for online events.',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'venue':
      const venue = text.toLowerCase() === 'skip' ? null : (text.toLowerCase() === 'tbd' ? 'TBD' : text);
      state.venue = venue;
      state.step = 'details';
      await ctx.reply(
        '**Step 5/6:** Any additional details about the event?\n\n' +
        'You can provide a description, special requirements, or type "skip" to continue.',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'details':
      const details = text.toLowerCase() === 'skip' ? undefined : text;
      state.details = details;
      state.step = 'tasks';
      
      // Show task selection options
      const allTemplates = getAllTaskTemplates();
      const recommendedTasks = getRequiredTasks(state.format);
      
      let taskMessage = '**Step 6/6:** Select tasks for this event\n\n';
      taskMessage += '**Recommended tasks for this event format:**\n';
      recommendedTasks.forEach((task, index) => {
        taskMessage += `✅ ${index + 1}. ${task.title} - ${task.description}\n`;
      });
      
      taskMessage += '\n**All available tasks:**';
      taskMessage += formatTaskTemplatesForSelection(allTemplates);
      
      taskMessage += '\n\n**Instructions:**\n';
      taskMessage += '• Type "recommended" to use only the recommended tasks\n';
      taskMessage += '• Type task numbers separated by commas (e.g., "1,3,7,12") to select specific tasks\n';
      taskMessage += '• Type "all" to include all available tasks\n';
      taskMessage += '• Type "none" to create the event without any tasks\n';
      taskMessage += '• Type "custom" to add a custom task (you can add multiple). When you are done adding custom tasks, type one of the options above or "done" to finish';
      state.customTasks = [];
      state.pendingTask = undefined;
      
      await ctx.reply(taskMessage, { parse_mode: 'Markdown' });
      break;

    case 'tasks':
      const taskSelection = text.toLowerCase().trim();
      let selectedTasks: { title: string; description: string }[] = [];
      if (taskSelection === 'custom') {
        state.step = 'custom_task_title';
        await ctx.reply('🆕 Enter custom task title:');
        return;
      }
      if (taskSelection === 'done') {
        // Proceed with only custom tasks if any
        selectedTasks = [];
      }
      if (taskSelection === 'recommended') {
        selectedTasks = getRequiredTasks(state.format);
      } else if (taskSelection === 'all') {
        selectedTasks = getAllTaskTemplates().map(t => ({ title: t.title, description: t.description }));
      } else if (taskSelection === 'none') {
        selectedTasks = [];
      } else {
        // Parse comma-separated task numbers
        const taskNumbers = taskSelection.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const allTemplates = getAllTaskTemplates();
        
        for (const num of taskNumbers) {
          if (num >= 1 && num <= allTemplates.length) {
            const template = allTemplates[num - 1];
            if (template) {
              selectedTasks.push({ title: template.title, description: template.description });
            }
          }
        }
        
        if (selectedTasks.length === 0 && taskNumbers.length > 0) {
          await ctx.reply('❌ Invalid task selection. Please try again with valid task numbers.');
          return;
        }
      }
      
      // Create the event
      const event = await DrizzleDatabaseService.createEvent(
        state.title,
        state.date,
        state.format,
        state.details,
        state.venue,
        state.createdBy
      );
      
      if (!event) {
        await ctx.reply('❌ Failed to create event. Please try again.');
        conversationState.delete(userId);
        return;
      }

      // Merge in any custom tasks collected
      const mergedTasks = [...selectedTasks];
      if (Array.isArray(state.customTasks) && state.customTasks.length > 0) {
        for (const ct of state.customTasks) {
          mergedTasks.push({ title: ct.title, description: ct.description || '' });
        }
      }

      // Create selected tasks for the event
      const createdTasks = [];
      
      for (const taskTemplate of mergedTasks) {
        const task = await DrizzleDatabaseService.createTask(
          event.id,
          taskTemplate.title,
          taskTemplate.description
        );
        if (task) {
          createdTasks.push(task);
        }
      }

      // Clear conversation state
      conversationState.delete(userId);
      
      let successMessage = `✅ <b>Event created successfully!</b>\n\n`;
      const createdDetails = await formatEventDetails(event, createdTasks);
      successMessage += createdDetails;
      successMessage += `\nEvent ID: <b>${event.id}</b>\n`;
      if (createdTasks.length > 0) {
        successMessage += `\n<b>Task IDs for reference:</b>\n`;
        createdTasks.forEach(task => {
          successMessage += `• ${task.title}: <b>${task.id}</b>\n`;
        });
        successMessage += `\nUse <code>/assign_task &lt;task_id&gt; @volunteer</code> to assign volunteers to tasks.`;
      } else {
        successMessage += `\nNo tasks were created for this event.`;
      }
      
      await ctx.reply(successMessage, { parse_mode: 'HTML' });
      break;

    case 'custom_task_title': {
      if (!state.customTasks) state.customTasks = [];
      state.pendingTask = { title: text };
      state.step = 'custom_task_desc';
      await ctx.reply('Enter custom task description (or type `skip`):', { parse_mode: 'Markdown' });
      break;
    }
    case 'custom_task_desc': {
      const desc = text.toLowerCase() === 'skip' ? '' : text;
      const pt = state.pendingTask || { title: 'Untitled' };
      state.customTasks.push({ title: pt.title, description: desc });
      state.pendingTask = undefined;
      state.step = 'tasks';
      await ctx.reply('✅ Custom task added. You can type `custom` to add another, or select from templates, or type `done` to finish.', { parse_mode: 'Markdown' });
      break;
    }
  }
};

// /remove_event <event_id> - delete an event and its tasks
export const removeEventCommand = async (ctx: CommandContext<Context>) => {
  const userId = ctx.from?.id;
  const telegramHandle = ctx.from?.username;
  if (!telegramHandle) {
    await ctx.reply('❌ Please set a Telegram username to use this command.');
    return;
  }

  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  if (!isAdmin) {
    await ctx.reply('❌ Only admins can remove events.');
    return;
  }

  const arg = ctx.match?.toString().trim();
  if (!arg) {
    await ctx.reply('❌ **Usage:** `/remove_event <event_id>`', { parse_mode: 'Markdown' });
    return;
  }
  const eventId = parseInt(arg, 10);
  if (isNaN(eventId)) {
    await ctx.reply('❌ Invalid event ID.');
    return;
  }

  const existing = await DrizzleDatabaseService.getEvent(eventId);
  if (!existing) {
    await ctx.reply('❌ Event not found.');
    return;
  }
  if (!userId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  // Ask for confirmation and store pending deletion
  removeEventState.set(userId, { eventId });
  await ctx.reply(
    `⚠️ Are you sure you want to permanently delete event "${existing.title}" (ID: ${existing.id}) and all its tasks?
Reply with YES to confirm, or NO to cancel.`,
    { parse_mode: 'Markdown' }
  );
};

// Handle confirmation replies for /remove_event
export const handleRemoveEventConfirmation = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return;

  const pending = removeEventState.get(userId);
  if (!pending) return;

  const answer = text.toLowerCase();
  if (['no', 'n', 'cancel'].includes(answer)) {
    removeEventState.delete(userId);
    await ctx.reply('✅ Event removal cancelled.');
    return;
  }

  if (['yes', 'y', 'confirm'].includes(answer)) {
    const ok = await DrizzleDatabaseService.deleteEvent(pending.eventId);
    removeEventState.delete(userId);
    if (ok) {
      await ctx.reply(`✅ Event ${pending.eventId} removed successfully.`);
    } else {
      await ctx.reply('❌ Failed to remove event.');
    }
    return;
  }

  // If input is not recognized, remind user
  await ctx.reply('Please reply with YES to confirm, or NO to cancel.');
};

// /list_events command - list upcoming events with simplified format
export const listEventsCommand = async (ctx: CommandContext<Context>) => {
  const allEvents = await DrizzleDatabaseService.getAllUpcomingEvents();
  // Sort chronologically by event date (TBD sentinel will naturally go last)
  const events = [...allEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!events || events.length === 0) {
    await ctx.reply('📅 No upcoming events found.');
    return;
  }

  let message = '📅 <b>Upcoming Events:</b>\n\n';
  const formatEmoji: Record<string, string> = {
    talk: '🎤',
    workshop: '🛠️',
    moderated_discussion: '🗣️',
    conference: '🏛️',
    hangout: '☕',
    meeting: '📎',
    external_speaker: '🌐',
    newsletter: '📰',
    social_media_campaign: '📣',
    coding_project: '💻',
    panel: '👥',
    others: '📌',
  };
  
  for (const event of events) {
    const tasks = await DrizzleDatabaseService.getEventTasks(event.id);
    const emoji = formatEmoji[event.format] || '📌';
    const dateText = isTbdDateIso(event.date) ? 'TBD' : formatHumanDate(event.date);

    // Count unassigned tasks by checking task assignments
    let unassignedCount = 0;
    for (const task of tasks) {
      const assignments = await DrizzleDatabaseService.getTaskAssignments(task.id);
      if (assignments.length === 0) {
        unassignedCount++;
      }
    }
    const totalTasks = tasks.length;
    
    message += `${emoji} <b>${event.title}</b> (ID: ${event.id})\n`;
    message += `Date: ${dateText} | Status: ${event.status}`;
    if (event.venue) {
      message += ` | 📍 ${event.venue}`;
    }
    message += `\n`;
    
    if (totalTasks > 0) {
      const unassignedText = unassignedCount > 0 ? `⚠️ <b>${unassignedCount}</b>` : `✅ ${unassignedCount}`;
      message += `Tasks: ${unassignedText}/${totalTasks} tasks needing volunteers \n`;
    } else {
      message += `📋 No tasks created yet\n`;
    }
    
    message += '\n';
  }

  message += '💡 <b>Quick Commands:</b>\n';
  message += '• <code>/commit &lt;task_id&gt;</code> - Sign up for a task\n';
  message += '• <code>/event_details &lt;event_id&gt;</code> - View detailed event info and tasks\n';
  message += '• <code>/uncommit &lt;task_id&gt;</code> - Remove yourself from a task';

  await ctx.reply(message, { parse_mode: 'HTML' });
};

// /event_details command - show detailed event information
export const eventDetailsCommand = async (ctx: CommandContext<Context>) => {
  const eventIdStr = ctx.match?.toString().trim();
  
  if (!eventIdStr) {
    await ctx.reply(
      '❌ **Usage:** `/event_details <event_id>`\n\n' +
      '**Example:** `/event_details 1`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const eventId = parseInt(eventIdStr);
  
  if (isNaN(eventId)) {
    await ctx.reply('❌ Invalid event ID.');
    return;
  }

  const event = await DrizzleDatabaseService.getEvent(eventId);
  
  if (!event) {
    await ctx.reply('❌ Event not found.');
    return;
  }

  const tasks = await DrizzleDatabaseService.getEventTasks(eventId);
  const eventDetails = await formatEventDetails(event, tasks);

  // Determine if requester can broadcast: admin or event creator
  const requesterHandle = ctx.from?.username;
  let canBroadcast = false;
  if (requesterHandle) {
    const isAdmin = await DrizzleDatabaseService.isAdmin(requesterHandle);
    if (isAdmin) {
      canBroadcast = true;
    } else {
      const me = await DrizzleDatabaseService.getVolunteerByHandle(requesterHandle);
      if (me && event.created_by === me.id) canBroadcast = true;
    }
  }

  let message = `📅 <b>Event Details:</b>\n\n${eventDetails}`;
  if (canBroadcast) {
    message += `\n\n📣 <b>Quick Action:</b> Use <code>/broadcast_event_details ${event.id}</code> to announce this event to the group.`;
  }
  await ctx.reply(message, { parse_mode: 'HTML' });
};


// Clear conversation state on cancel
export const cancelCommand = async (ctx: CommandContext<Context>) => {
  const userId = ctx.from?.id;
  
  if (userId && conversationState.has(userId)) {
    conversationState.delete(userId);
    await ctx.reply('❌ Current operation cancelled.');
  } else {
    await ctx.reply('ℹ️ No active operation to cancel.');
  }
};

// Handler function for tests
export const handleListEventsCommand = async (ctx: CommandContext<Context>) => {
  await listEventsCommand(ctx);
};
