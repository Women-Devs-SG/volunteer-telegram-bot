import type { Event } from '../types';

export const getRequiredTasks = (format: Event['format']): { title: string; description: string }[] => {
  const baseTasks = [
    { title: 'Content Creation', description: 'Create content for the event or publication' },
    { title: 'Pre-event Marketing', description: 'Promote the event before it happens' },
    { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event' }
  ];

  switch (format) {
    case 'panel':
      return [
        ...baseTasks,
        { title: 'Moderation', description: 'Moderate the panel discussion' },
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' },
        { title: 'Speaker Confirmation', description: 'Confirm speakers and their topics' }
      ];
    case 'workshop':
      return [
        ...baseTasks,
        { title: 'Facilitation', description: 'Facilitate the workshop activities' },
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' }
      ];
    case 'conference':
    case 'talk':
    case 'external_speaker':
      return [
        ...baseTasks,
        { title: 'Speaker Coordination', description: 'Coordinate with speakers and manage logistics' },
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' }
      ];
    case 'meeting':
    case 'hangout':
      return [
        { title: 'Date Confirmation', description: 'Confirm the event date with all participants' },
        { title: 'Venue Coordination', description: 'Coordinate venue logistics and setup'},
        { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event' }
      ];
    case 'moderated_discussion':
      return [
        ...baseTasks,
        { title: 'Moderation', description: 'Moderate the discussion' },
        { title: 'Topic Preparation', description: 'Prepare discussion topics and questions' }
      ];
    case 'newsletter':
      return [
        { title: 'Content Creation', description: 'Create newsletter content' },
        { title: 'Review and Editing', description: 'Review and edit the newsletter before publishing' }
      ];
    case 'social_media_campaign':
      return [
        { title: 'Content Planning', description: 'Plan social media content for the campaign' },
        { title: 'Content Creation', description: 'Create posts, stories, and other content' },
        { title: 'Content Posting', description: 'Post content on social media platforms' }
      ];
    case 'coding_project':
      return [
        ...baseTasks,
        { title: 'Code Repo Maintainer', description: 'Lead maintenance of the project repository' },
        { title: 'Contributor Onboarding', description: 'Guide new contributors on setup and first PR' },
        { title: 'Issue Triage', description: 'Label, prioritize, and manage issues for contributors' },
        { title: 'Documentation Updates', description: 'Improve READMEs, CONTRIBUTING.md, and docs' },
        { title: 'Review PRs', description: 'Review, provide feedback, and merge PRs during the event' },
        { title: 'Community Support', description: 'Help answer questions and support contributors' }
      ];
    default:
      return baseTasks;
  }
};

export const getAllTaskTemplates = (): { title: string; description: string; category: string }[] => {
  return [
    // Base
    { title: 'Content Creation', description: 'Create content for the event or publication', category: 'Base' },

    // Marketing tasks
    { title: 'Pre-event Marketing', description: 'Promote the event before it happens', category: 'Marketing' },
    { title: 'Post-event Marketing', description: 'Share highlights and follow-up after the event', category: 'Marketing' },
    { title: 'Social Media Promotion', description: 'Create and share social media content', category: 'Marketing' },
    { title: 'Newsletter Announcement', description: 'Include event in newsletter', category: 'Marketing' },

    // Coordination tasks
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

    // Content Creation
    { title: 'Content Planning', description: 'Plan content structure and topics', category: 'Content' },
    { title: 'Review and Editing', description: 'Review and edit content before publishing', category: 'Content' },

    // General
    { title: 'Registration Management', description: 'Manage event registrations and attendee list', category: 'General' },
    { title: 'Follow-up Communications', description: 'Send follow-up messages to attendees', category: 'General' },
    { title: 'Documentation', description: 'Document event outcomes and learnings', category: 'General' }
  ];
};

export const formatTaskTemplatesForSelection = (templates: { title: string; description: string; category: string }[]): string => {
  let message = '';
  const categories = [...new Set(templates.map(t => t.category))];
  categories.forEach(category => {
    message += `\n**${category}:**\n`;
    const categoryTasks = templates.filter(t => t.category === category);
    categoryTasks.forEach((task) => {
      const globalIndex = templates.indexOf(task) + 1;
      message += `${globalIndex}. ${task.title} - ${task.description}\n`;
    });
  });
  return message;
};
