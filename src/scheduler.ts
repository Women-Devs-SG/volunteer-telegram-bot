import { Bot } from 'grammy';
import { processMonthlyVolunteerStatus } from './utils';
import { parseTopicLink } from './parse-topic-link';

/**
 * Scheduler for automated monthly volunteer status processing
 * This module handles the monthly commitment tracking and status updates
 */

export class VolunteerScheduler {
  private bot: Bot;
  private monthlyInterval: NodeJS.Timeout | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Validate if a channel ID is properly configured (not a placeholder)
   */
  private isValidChannelId(channelId: string): boolean {
    // Check for placeholder patterns
    if (channelId.includes('your_') || 
        channelId.includes('your-') || 
        channelId.includes('staging_') || 
        channelId.includes('production_') ||
        channelId.includes('test_')) {
      return false;
    }
    
    // Check if it's a valid Telegram channel ID format
    // Telegram channel IDs are typically negative numbers starting with -100
    const numericId = parseInt(channelId);
    if (isNaN(numericId)) {
      return false;
    }
    
    // Valid channel IDs should be negative and reasonably large
    return numericId < -1000;
  }

  /**
   * Validate if a topic ID is properly configured (not a placeholder)
   */
  private isValidTopicId(topicId: string): boolean {
    // Check for placeholder patterns
    if (topicId.includes('your_') || 
        topicId.includes('your-') || 
        topicId.includes('staging_') || 
        topicId.includes('production_') ||
        topicId.includes('test_')) {
      return false;
    }
    
    // Check if it's a valid numeric topic ID
    const numericId = parseInt(topicId);
    if (isNaN(numericId)) {
      return false;
    }
    
    // Topic IDs should be positive integers
    return numericId > 0;
  }

  /**
   * Start the monthly scheduler
   * Runs on the 1st of each month at 9:00 AM
   * Disabled in development environment
   */
  start() {
    // Don't run scheduler in development environment
    if (process.env.NODE_ENV === 'development') {
      console.log('📅 Monthly scheduler disabled in development environment');
      console.log('💡 Use /monthly_report command to test monthly processing manually');
      return;
    }

    // Calculate time until next first of month at 9:00 AM
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);
    const timeUntilNext = nextMonth.getTime() - now.getTime();

    console.log(`📅 Monthly volunteer status scheduler starting...`);
    console.log(`⏰ Next run scheduled for: ${nextMonth.toISOString()}`);

    // Set initial timeout to first run
    setTimeout(() => {
      this.runMonthlyProcess();
      
      // Then set up monthly interval (every 30 days)
      this.monthlyInterval = setInterval(() => {
        this.runMonthlyProcess();
      }, 30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
      
    }, timeUntilNext);
  }

  /**
   * Stop the monthly scheduler
   */
  stop() {
    if (this.monthlyInterval) {
      clearInterval(this.monthlyInterval);
      this.monthlyInterval = null;
      console.log('📅 Monthly volunteer status scheduler stopped');
    }
  }

  /**
   * Run the monthly volunteer status processing
   * This will update volunteer statuses based on commitments and send reports
   */
  private async runMonthlyProcess() {
    try {
      console.log('📊 Running monthly volunteer status processing...');
      
      const reportMessage = await processMonthlyVolunteerStatus(this.bot);
      
      // Send report to admin channel if configured
      let adminChannelId = process.env.ADMIN_CHANNEL_ID;
      let adminTopicId = process.env.ADMIN_TOPIC_ID;
      
      // Check if topic link is provided instead
      const adminTopicLink = process.env.ADMIN_TOPIC_LINK;
      if (adminTopicLink && !adminChannelId) {
        const parsed = parseTopicLink(adminTopicLink);
        if (parsed) {
          adminChannelId = parsed.channelId;
          adminTopicId = parsed.topicId;
        }
      }
      
      // Only send to admin channel if it's properly configured (not placeholder)
      if (adminChannelId && this.isValidChannelId(adminChannelId)) {
        const options: any = { parse_mode: 'Markdown' };
        
        // If topic ID is provided and valid, send to specific topic in forum channel
        if (adminTopicId && this.isValidTopicId(adminTopicId)) {
          options.message_thread_id = parseInt(adminTopicId);
        }
        
        await this.bot.api.sendMessage(adminChannelId, reportMessage, options);
        console.log('✅ Monthly report sent to admin channel');
      } else {
        console.log('⚠️ No valid admin channel configured - report not sent automatically');
        console.log('💡 Configure ADMIN_CHANNEL_ID in your environment to enable automatic reports');
        console.log('Report content:', reportMessage);
      }
      
      console.log('✅ Monthly volunteer status processing completed');
    } catch (error) {
      console.error('❌ Error running monthly volunteer status processing:', error);
      
      // Send error notification to admin channel if properly configured
      const errorAdminChannelId = process.env.ADMIN_CHANNEL_ID;
      if (errorAdminChannelId && this.isValidChannelId(errorAdminChannelId)) {
        try {
          await this.bot.api.sendMessage(
            errorAdminChannelId, 
            '❌ **Error in Monthly Volunteer Processing**\n\nThe automated monthly volunteer status update failed. Please run `/monthly_report` manually to process this month\'s data.',
            { parse_mode: 'Markdown' }
          );
        } catch (notificationError) {
          console.error('❌ Failed to send error notification:', notificationError);
        }
      }
    }
  }

  /**
   * Manually trigger the monthly process (for testing or manual runs)
   */
  async runManual(): Promise<string> {
    console.log('🔧 Manually triggering monthly volunteer status processing...');
    return await processMonthlyVolunteerStatus(this.bot);
  }
}
