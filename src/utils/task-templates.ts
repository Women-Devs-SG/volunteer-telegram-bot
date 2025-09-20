import type { Event } from '../types';

// Beginner-friendly task templates
// --------------------------------
// How to add/edit tasks:
// 1) Add a new entry to TASKS below (title, description, category).
// 2) If the task should be "required" for some event formats, add its title
//    to REQUIRED_BY_FORMAT for those formats.
// 3) Titles should be unique so they can be referenced from REQUIRED_BY_FORMAT.

export type TaskTemplate = {
  title: string;
  description: string;
  category: 'Base' | 'Marketing' | 'Coordination' | 'Event Management' | 'Coding Project' | 'Content' | 'General';
};

// Single source of truth for all task templates (easy to edit)
export const TASKS: TaskTemplate[] = [
  // Base
  { title: 'Content Creation', description: 'Create content for the event or publication', category: 'Base' },

  // Marketing
  { title: 'Pre-event Marketing', description: 'Promote the event before it happens', category: 'Marketing' },
  { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event', category: 'Marketing' },
  { title: 'Social Media Promotion', description: 'Create and share social media content', category: 'Marketing' },
  { title: 'Newsletter Announcement', description: 'Include event in newsletter', category: 'Marketing' },
  { title: 'Content Posting', description: 'Post prepared content across social platforms', category: 'Marketing' },

  // Coordination
  { title: 'Date Confirmation', description: 'Confirm the event date with all participants', category: 'Coordination' },
  { title: 'Speaker Confirmation', description: 'Confirm speakers and their topics', category: 'Coordination' },
  { title: 'Speaker Coordination', description: 'Coordinate with speakers and manage logistics', category: 'Coordination' },
  { title: 'Venue Coordination', description: 'Coordinate venue logistics and setup', category: 'Coordination' },

  // Event Management
  { title: 'Moderation', description: 'Moderate the panel discussion or event', category: 'Event Management' },
  { title: 'Facilitation', description: 'Facilitate the workshop activities or discussion', category: 'Event Management' },
  { title: 'Topic Preparation', description: 'Prepare discussion topics and questions', category: 'Event Management' },
  { title: 'Technical Setup', description: 'Handle technical equipment and setup', category: 'Event Management' },

  // Coding Project
  { title: 'Code Repo Maintainer', description: 'Lead maintenance of the project repository', category: 'Coding Project' },
  { title: 'Contributor Onboarding', description: 'Guide new contributors on setup and first PR', category: 'Coding Project' },
  { title: 'Issue Triage', description: 'Label, prioritize, and manage issues for contributors', category: 'Coding Project' },
  { title: 'Documentation Updates', description: 'Improve READMEs, CONTRIBUTING.md, and docs', category: 'Coding Project' },
  { title: 'Review PRs', description: 'Review, provide feedback, and merge PRs', category: 'Coding Project' },
  { title: 'Community Support', description: 'Help answer questions and support contributors', category: 'Coding Project' },

  // Content
  { title: 'Content Planning', description: 'Plan content structure and topics', category: 'Content' },
  { title: 'Review and Editing', description: 'Review and edit content before publishing', category: 'Content' },

  // General
  { title: 'Registration Management', description: 'Manage event registrations and attendee list', category: 'General' },
  { title: 'Follow-up Communications', description: 'Send follow-up messages to attendees', category: 'General' },
  { title: 'Documentation', description: 'Document event outcomes and learnings', category: 'General' },
];

// Map of required tasks by event format. Use task TITLES from TASKS above.
const REQUIRED_BY_FORMAT: Record<Event['format'] | 'default', string[]> = {
  default: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing'],
  panel: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing', 'Moderation', 'Date Confirmation', 'Speaker Confirmation'],
  workshop: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing', 'Facilitation', 'Date Confirmation'],
  conference: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing', 'Speaker Coordination', 'Date Confirmation'],
  talk: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing', 'Speaker Coordination', 'Date Confirmation'],
  external_speaker: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing', 'Speaker Coordination', 'Date Confirmation'],
  others: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing'],
  meeting: ['Date Confirmation', 'Venue Coordination', 'Post-event Marketing'],
  hangout: ['Date Confirmation', 'Venue Coordination', 'Post-event Marketing'],
  moderated_discussion: ['Content Creation', 'Pre-event Marketing', 'Post-event Marketing', 'Moderation', 'Topic Preparation'],
  newsletter: ['Content Creation', 'Review and Editing'],
  social_media_campaign: ['Content Planning', 'Content Creation', 'Content Posting'],
  coding_project: [
    'Content Creation',
    'Pre-event Marketing',
    'Post-event Marketing',
    'Code Repo Maintainer',
    'Contributor Onboarding',
    'Issue Triage',
    'Documentation Updates',
    'Review PRs',
    'Community Support',
  ],
};

// Helper: find a task by title from TASKS
const findTaskByTitle = (title: string) => TASKS.find(t => t.title === title);

export const getRequiredTasks = (format: Event['format']): { title: string; description: string }[] => {
  const titles = REQUIRED_BY_FORMAT[format] || REQUIRED_BY_FORMAT.default;
  return titles
    .map(findTaskByTitle)
    .filter((t): t is TaskTemplate => !!t)
    .map(t => ({ title: t.title, description: t.description }));
};

export const getAllTaskTemplates = (): { title: string; description: string; category: string }[] => {
  return TASKS.map(t => ({ ...t }));
};

export const formatTaskTemplatesForSelection = (templates: { title: string; description: string; category: string }[]): string => {
  let message = '';
  const categories = [...new Set(templates.map(t => t.category))].sort();
  categories.forEach(category => {
    message += `\n**${category}:**\n`;
    const categoryTasks = templates
      .filter(t => t.category === category)
      .map((t, idx) => ({ t, idx: templates.indexOf(t) }))
      .sort((a, b) => a.idx - b.idx);
    categoryTasks.forEach(({ t }) => {
      const globalIndex = templates.indexOf(t) + 1;
      message += `${globalIndex}. ${t.title} - ${t.description}\n`;
    });
  });
  return message;
};
