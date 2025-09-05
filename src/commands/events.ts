import { Context, CommandContext } from 'grammy';
import { DrizzleDatabaseService } from '../db-drizzle';
import { Event } from '../types';
import { 
  getRequiredTasks, 
  parseDate, 
  formatEventDetails,
  formatTaskStatus,
  getAllTaskTemplates,
  formatTaskTemplatesForSelection,
  filterFutureEvents
} from '../utils';

// Store conversation state for interactive wizard
const conversationState = new Map<number, any>();

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

  // Check if user is an admin
  const isAdmin = await DrizzleDatabaseService.isAdmin(telegramHandle);
  if (!isAdmin) {
    await ctx.reply('❌ Only admins can create events. Please contact an administrator.');
    return;
  }

  // Initialize conversation state
  conversationState.set(userId, { step: 'title' });
  
  await ctx.reply(
    '🎯 **Event Creation Wizard**\n\n' +
    'Let\'s create a new event! I\'ll guide you through the process.\n\n' +
    '**Step 1/6:** What is the event title?',
    { parse_mode: 'Markdown' }
  );
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
        '• Natural language (e.g., "next Friday", "March 15th")',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'date':
      const parsedDate = parseDate(text);
      if (!parsedDate) {
        await ctx.reply('❌ Invalid date format. Please try again with a valid date.');
        return;
      }
      
      state.date = parsedDate.toISOString();
      state.step = 'format';
      await ctx.reply(
        '**Step 3/6:** What is the event format?\n\n' +
        'Please choose one:\n' +
        '• **talk** - Single speaker presentation\n' +
        '• **workshop** - Interactive learning session\n' +
        '• **moderated_discussion** - Facilitated discussion\n' +
        '• **conference** - Large-scale conference\n' +
        '• **hangout** - Casual social gathering\n' +
        '• **meeting** - Formal meeting\n' +
        '• **external_speaker** - Event with external speaker\n' +
        '• **newsletter** - Newsletter content creation\n' +
        '• **social_media_takeover** - Social media content\n' +
        '• **others** - Other event type\n\n' +
        'Type the format name (e.g., "workshop")',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'format':
      const format = text.toLowerCase().replace(/\s+/g, '_') as Event['format'];
      const validFormats = ['workshop', 'panel', 'conference', 'talk', 'hangout', 'meeting', 
                           'external_speaker', 'newsletter', 'social_media_takeover', 
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
      taskMessage += '• Type "none" to create the event without any tasks';
      
      await ctx.reply(taskMessage, { parse_mode: 'Markdown' });
      break;

    case 'tasks':
      const taskSelection = text.toLowerCase().trim();
      let selectedTasks: { title: string; description: string }[] = [];
      
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
        state.venue
      );
      
      if (!event) {
        await ctx.reply('❌ Failed to create event. Please try again.');
        conversationState.delete(userId);
        return;
      }

      // Create selected tasks for the event
      const createdTasks = [];
      
      for (const taskTemplate of selectedTasks) {
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
      
      let successMessage = `✅ **Event created successfully!**\n\n`;
      successMessage += formatEventDetails(event, createdTasks);
      successMessage += `\nEvent ID: **${event.id}**\n`;
      if (createdTasks.length > 0) {
        successMessage += `\n**Task IDs for reference:**\n`;
        createdTasks.forEach(task => {
          successMessage += `• ${task.title}: **${task.id}**\n`;
        });
        successMessage += `\nUse \`/assign_task <task_id> @volunteer\` to assign volunteers to tasks.`;
      } else {
        successMessage += `\nNo tasks were created for this event.`;
      }
      
      await ctx.reply(successMessage, { parse_mode: 'Markdown' });
      break;
  }
};

// /finalize_event command - mark event as finalized and publish
export const finalizeEventCommand = async (ctx: CommandContext<Context>) => {
  const eventIdStr = ctx.match?.toString().trim();
  
  if (!eventIdStr) {
    await ctx.reply(
      '❌ **Usage:** `/finalize_event <event_id>`\n\n' +
      '**Example:** `/finalize_event 1`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const eventId = parseInt(eventIdStr);
  
  if (isNaN(eventId)) {
    await ctx.reply('❌ Invalid event ID. Please provide a valid number.');
    return;
  }

  // Check if event exists
  const event = await DrizzleDatabaseService.getEvent(eventId);
  
  if (!event) {
    await ctx.reply('❌ Event not found.');
    return;
  }

  if (event.status === 'published') {
    await ctx.reply('❌ Event is already published.');
    return;
  }

  // Get event tasks to check completion
  const tasks = await DrizzleDatabaseService.getEventTasks(eventId);
  const incompleteTasks = tasks.filter(task => task.status !== 'complete');
  
  if (incompleteTasks.length > 0) {
    let warningMessage = '⚠️ **Warning:** The following tasks are still incomplete:\n\n';
    incompleteTasks.forEach(task => {
      warningMessage += `• ${task.title} (${formatTaskStatus(task.status)})\n`;
    });
    warningMessage += '\nAre you sure you want to finalize this event? Reply with "yes" to confirm or "no" to cancel.';
    
    await ctx.reply(warningMessage, { parse_mode: 'Markdown' });
    
    // Set up confirmation state
    conversationState.set(ctx.from!.id, { 
      step: 'confirm_finalize', 
      eventId: eventId 
    });
    return;
  }

  // Finalize the event
  await finalizeEvent(ctx, eventId, event);
};

// Handle finalization confirmation
export const handleFinalizationConfirmation = async (ctx: Context) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.toLowerCase();
  
  if (!userId || !text || !conversationState.has(userId)) {
    return;
  }

  const state = conversationState.get(userId);
  
  if (state.step === 'confirm_finalize') {
    if (text === 'yes') {
      const event = await DrizzleDatabaseService.getEvent(state.eventId);
      if (event) {
        await finalizeEvent(ctx, state.eventId, event);
      }
    } else if (text === 'no') {
      await ctx.reply('❌ Event finalization cancelled.');
    } else {
      await ctx.reply('Please reply with "yes" to confirm or "no" to cancel.');
      return;
    }
    
    conversationState.delete(userId);
  }
};

// Helper function to finalize event
const finalizeEvent = async (ctx: Context, eventId: number, event: Event) => {
  const success = await DrizzleDatabaseService.updateEventStatus(eventId, 'published');
  
  if (success) {
    await ctx.reply(
      `✅ **Event finalized and published!**\n\n` +
      `"${event.title}" has been marked as published.\n\n` +
      `🔗 **Mock Meetup Integration:** Event would now be published to Meetup.com\n` +
      `📅 Date: ${new Date(event.date).toLocaleDateString()}\n` +
      `📍 Format: ${event.format}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply('❌ Failed to finalize event. Please try again.');
  }
};

// /list_events command - list all events
export const listEventsCommand = async (ctx: CommandContext<Context>) => {
  const allEvents = await DrizzleDatabaseService.getAllEvents();
  const events = filterFutureEvents(allEvents);

  if (!events || events.length === 0) {
    await ctx.reply('📅 No upcoming events found.');
    return;
  }

  let message = '📅 **Upcoming Events:**\n\n';
  
  const planningEvents = events.filter(e => e.status === 'planning');
  const publishedEvents = events.filter(e => e.status === 'published');

  if (planningEvents.length > 0) {
    message += '**🟡 Planning Events:**\n';
    for (const event of planningEvents) {
      const tasks = await DrizzleDatabaseService.getEventTasks(event.id);
      const completedCount = tasks.filter(t => t.status === 'complete').length;
      const totalCount = tasks.length;
      
      message += `• **${event.title}** (ID: ${event.id})\n`;
      message += `  📅 ${new Date(event.date).toLocaleDateString()}\n`;
      message += `  📍 ${event.format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
      if (event.venue) {
        message += `  🏢 ${event.venue}\n`;
      }
      message += `  ✅ Tasks: ${completedCount}/${totalCount} completed\n\n`;
    }
  }

  if (publishedEvents.length > 0) {
    message += '**🟢 Published Events:**\n';
    for (const event of publishedEvents) {
      message += `• **${event.title}** (ID: ${event.id})\n`;
      message += `  📅 ${new Date(event.date).toLocaleDateString()}\n`;
      message += `  📍 ${event.format}\n\n`;
    }
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
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
  const eventDetails = formatEventDetails(event, tasks);
  
  await ctx.reply(`📅 **Event Details:**\n\n${eventDetails}`, { parse_mode: 'Markdown' });
};

// /list_events_with_tasks command - list events with task IDs for easy reference
export const listEventsWithTasksCommand = async (ctx: CommandContext<Context>) => {
  const allEvents = await DrizzleDatabaseService.getAllEvents();
  const events = filterFutureEvents(allEvents);

  if (!events || events.length === 0) {
    await ctx.reply('📅 No upcoming events found.');
    return;
  }

  let message = '📅 **Upcoming Events with Task IDs:**\n\n';
  
  for (const event of events) {
    const tasks = await DrizzleDatabaseService.getEventTasks(event.id);
    const statusIcon = event.status === 'published' ? '🟢' : event.status === 'planning' ? '🟡' : '🔴';
    
    message += `${statusIcon} **${event.title}** (Event ID: **${event.id}**)\n`;
    message += `📅 ${new Date(event.date).toLocaleDateString()} | 📍 ${event.format.replace(/_/g, ' ')}\n`;
    
    if (tasks.length > 0) {
      message += `**Tasks:**\n`;
      tasks.forEach(task => {
        const taskStatusIcon = task.status === 'complete' ? '✅' : task.status === 'in_progress' ? '🔄' : '❌';
        message += `  • ${task.title} (ID: **${task.id}**) ${taskStatusIcon}\n`;
      });
    } else {
      message += `  _No tasks assigned_\n`;
    }
    
    message += '\n';
  }

  message += '💡 **Quick Commands:**\n';
  message += '• `/assign_task <task_id> @volunteer` - Assign task to volunteer\n';
  message += '• `/event_details <event_id>` - View detailed event info\n';
  message += '• `/finalize_event <event_id>` - Finalize and publish event';

  await ctx.reply(message, { parse_mode: 'Markdown' });
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
