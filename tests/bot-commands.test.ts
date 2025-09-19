import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bot } from 'grammy';

// Mock the database service
vi.mock('../src/db-drizzle', () => ({
  DrizzleDatabaseService: {
    getVolunteerByHandle: vi.fn(),
    createVolunteer: vi.fn(),
    isAdmin: vi.fn(),
    getAllVolunteers: vi.fn(),
    getAllEvents: vi.fn(),
    createEvent: vi.fn(),
    updateVolunteerStatus: vi.fn(),
    getEventTasks: vi.fn(),
  }
}));

// Mock grammy Bot
vi.mock('grammy', () => ({
  Bot: vi.fn().mockImplementation(() => ({
    command: vi.fn(),
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    api: {
      sendMessage: vi.fn(),
    }
  })),
  Context: vi.fn(),
  InlineKeyboard: vi.fn().mockImplementation(() => ({
    text: vi.fn().mockReturnThis(),
    row: vi.fn().mockReturnThis(),
  }))
}));

describe('Bot Commands', () => {
  let mockBot: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockBot = new Bot('mock-token');
    mockCtx = {
      message: {
        from: {
          username: 'testuser',
          name: 'Test User',
        },
        text: '/start'
      },
      reply: vi.fn(),
      replyWithPhoto: vi.fn(),
      match: '',
      from: {
        username: 'testuser',
        first_name: 'Test User'
      }
    };
  });

  describe('Registration Commands', () => {
    it('should handle start command for new users', async () => {
      const { DrizzleDatabaseService } = await import('../src/db-drizzle');
      
      // Mock that user doesn't exist
      vi.mocked(DrizzleDatabaseService.getVolunteerByHandle).mockResolvedValue(null);
      vi.mocked(DrizzleDatabaseService.createVolunteer).mockResolvedValue({
        id: 1,
        name: 'Test User',
        telegram_handle: 'testuser',
        status: 'probation',
        commitments: 0,
        commit_count_start_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Import and test the start command handler
      const { handleStartCommand } = await import('../src/commands/volunteers');
      
      await handleStartCommand(mockCtx);

      expect(DrizzleDatabaseService.getVolunteerByHandle).toHaveBeenCalledWith('testuser');
      expect(DrizzleDatabaseService.createVolunteer).toHaveBeenCalledWith(
        'Test User',
        'testuser',
        'probation'
      );
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should handle start command for existing users', async () => {
      const { DrizzleDatabaseService } = await import('../src/db-drizzle');
      
      // Mock that user exists
      vi.mocked(DrizzleDatabaseService.getVolunteerByHandle).mockResolvedValue({
        id: 1,
        name: 'Existing User',
        telegram_handle: 'testuser',
        status: 'active',
        commitments: 5,
        commit_count_start_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const { handleStartCommand } = await import('../src/commands/volunteers');
      
      await handleStartCommand(mockCtx);

      expect(DrizzleDatabaseService.getVolunteerByHandle).toHaveBeenCalledWith('testuser');
      expect(DrizzleDatabaseService.createVolunteer).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });

  describe('Admin Commands', () => {
    it('should handle list volunteers command for admins', async () => {
      const { DrizzleDatabaseService } = await import('../src/db-drizzle');
      
      // Mock admin status
      vi.mocked(DrizzleDatabaseService.isAdmin).mockResolvedValue(true);
      vi.mocked(DrizzleDatabaseService.getAllVolunteers).mockResolvedValue([
        {
          id: 1,
          name: 'Volunteer 1',
          telegram_handle: 'vol1',
          status: 'active',
          commitments: 3,
          commit_count_start_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Volunteer 2',
          telegram_handle: 'vol2',
          status: 'probation',
          commitments: 1,
          commit_count_start_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      const { handleListVolunteersCommand } = await import('../src/commands/admins');
      
      await handleListVolunteersCommand(mockCtx);

      expect(DrizzleDatabaseService.isAdmin).toHaveBeenCalledWith('testuser');
      expect(DrizzleDatabaseService.getAllVolunteers).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should deny access to non-admin users', async () => {
      const { DrizzleDatabaseService } = await import('../src/db-drizzle');
      
      // Mock non-admin status
      vi.mocked(DrizzleDatabaseService.isAdmin).mockResolvedValue(false);

      const { handleListVolunteersCommand } = await import('../src/commands/admins');
      
      await handleListVolunteersCommand(mockCtx);

      expect(DrizzleDatabaseService.isAdmin).toHaveBeenCalledWith('testuser');
      expect(DrizzleDatabaseService.getAllVolunteers).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ This command is only available to administrators.')
      );
    });
  });

  describe('Event Commands', () => {
    it('should handle list events command', async () => {
      const { DrizzleDatabaseService } = await import('../src/db-drizzle');
      
      vi.mocked(DrizzleDatabaseService.getAllEvents).mockResolvedValue([
        {
          id: 1,
          title: 'Test Event',
          date: new Date().toISOString(),
          format: 'workshop',
          status: 'planning',
          venue: 'Test Venue',
          details: 'Test details',
          created_by: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      // Mock getEventTasks to return sample tasks
      vi.mocked(DrizzleDatabaseService.getEventTasks).mockResolvedValue([
        {
          id: 1,
          event_id: 1,
          title: 'Test Task',
          description: 'Test task description',
          status: 'complete',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          event_id: 1,
          title: 'Another Task',
          description: 'Another task description',
          status: 'todo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      const { handleListEventsCommand } = await import('../src/commands/events');
      
      await handleListEventsCommand(mockCtx);

      expect(DrizzleDatabaseService.getAllEvents).toHaveBeenCalled();
      expect(DrizzleDatabaseService.getEventTasks).toHaveBeenCalledWith(1);
      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });
});
