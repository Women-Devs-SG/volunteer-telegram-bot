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
  guidance?: string;
};

// Single source of truth for all task templates (easy to edit)
export const TASKS: TaskTemplate[] = [

  // Marketing
  { title: 'Pre-event Marketing', description: 'Come up with marketing content using the posters created', category: 'Marketing', guidance: 'Once your content is ready, ask one of the leads to help you schedule the post. Get inspiration from our other posts on pre-event marketing.' },
  { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event', category: 'Marketing', guidance: 'Once your content is ready, ask one of the leads to help you schedule the post. Get inspiration from our other posts on post-event marketing.' },
  { title: 'Poster Making', description: 'Create posters (square and banner) for the event', category: 'Marketing', guidance: 'Use Canva (credentials: https://docs.google.com/document/d/1NuaWttmmgGuhTcqPh02s_eMrlq6frLtBXhFFVPRiQDk/edit?usp=sharing) or our content generator app (https://wds-content-generator.vercel.app/) to create a square poster for socials and a similar aesthetics event banner for Meetup.' },
  { title: 'Newsletter Announcement', description: 'Include event in newsletter', category: 'Marketing' },

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
  { title: 'Internal Speaker', description: 'Internal WDS member speaking slot for this event', category: 'Event Management' },

  // Coding Project
  { title: 'Code Repo Maintainer', description: 'Lead maintenance of the project repository', category: 'Coding Project' },
  { title: 'Contributor Onboarding', description: 'Guide new contributors on setup and first PR', category: 'Coding Project' },
  { title: 'Issue Triage', description: 'Label, prioritize, and manage issues for contributors', category: 'Coding Project' },
  { title: 'Documentation Updates', description: 'Improve READMEs, CONTRIBUTING.md, and docs', category: 'Coding Project' },
  { title: 'Review PRs', description: 'Review, provide feedback, and merge PRs', category: 'Coding Project' },
  { title: 'Community Support', description: 'Help answer questions and support contributors', category: 'Coding Project' },

  // Content
  { title: 'Content Planning', description: 'Plan content structure and topics', category: 'Content' },
  { title: 'Contribute Article', description: 'Write an article or post for the newsletter', category: 'Content' },
  { title: 'Review and Editing', description: 'Review and edit content before publishing', category: 'Content' },

  // General
  { title: 'Registration Management', description: 'Manage event registrations and attendee list', category: 'General' },
  { title: 'Follow-up Communications', description: 'Send follow-up messages to attendees', category: 'General' },
  { title: 'Documentation', description: 'Document event outcomes and learnings', category: 'General' },
  { title: 'Introduce WDS', description: 'Briefly introduce Women Devs SG and our mission at event start', category: 'General', guidance: '\n- Copy slides & feedback form from a recent event in GDrive\n- Slides: Update upcoming events & feedback QR code\n- Feedback form: Update description' },
];

// Map of required tasks by event format. Use task TITLES from TASKS above.
const REQUIRED_BY_FORMAT: Record<Event['format'] | 'default', string[]> = {
  default: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Introduce WDS'],
  panel: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Moderation', 'Speaker Confirmation', 'Introduce WDS'],
  workshop: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Facilitation', 'Introduce WDS'],
  conference: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Speaker Coordination', 'Introduce WDS'],
  talk: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Speaker Coordination', 'Introduce WDS'],
  external_speaker: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Speaker Coordination'],
  others: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing'],
  meeting: ['Date Confirmation', 'Venue Coordination', 'Post-event Marketing'],
  hangout: ['Date Confirmation', 'Venue Coordination', 'Post-event Marketing'],
  moderated_discussion: ['Poster Making', 'Pre-event Marketing', 'Post-event Marketing', 'Moderation', 'Topic Preparation'],
  newsletter: ['Contribute Article', 'Review and Editing'],
  social_media_campaign: ['Content Planning', 'Poster Making'],
  coding_project: [
    'Poster Making',
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
