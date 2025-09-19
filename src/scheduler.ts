import { Bot } from 'grammy';
import { processMonthlyVolunteerStatus } from './utils';

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

  // Removed admin channel/topic validation helpers (no dedicated admin channel usage)

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
      // No dedicated admin channel; just log the generated report for operators
      console.log('📊 Monthly report generated (not auto-sent to admin channel):');
      console.log(reportMessage);
      
      console.log('✅ Monthly volunteer status processing completed');
    } catch (error) {
      console.error('❌ Error running monthly volunteer status processing:', error);
      
      // No admin channel notifications; errors are logged only
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
