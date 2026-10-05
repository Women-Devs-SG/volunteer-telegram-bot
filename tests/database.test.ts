import { describe, it, expect } from 'vitest';
import { DrizzleDatabaseService } from '../src/db-drizzle';

describe('Database Service', () => {
  describe('Volunteer Operations', () => {
    it('should create a new volunteer', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer(
        'Test User',
        '@testuser',
        'probation'
      );

      expect(volunteer).toBeTruthy();
      expect(volunteer?.name).toBe('Test User');
      expect(volunteer?.telegram_handle).toBe('@testuser');
      expect(volunteer?.status).toBe('probation');
      expect(volunteer?.commitments).toBe(0);
      expect(volunteer?.cumulative_commitments).toBe(0);
    });

    it('should get volunteer by handle', async () => {
      // Create a volunteer first
      await DrizzleDatabaseService.createVolunteer('Jane Doe', '@janedoe', 'active');

      const volunteer = await DrizzleDatabaseService.getVolunteerByHandle('@janedoe');

      expect(volunteer).toBeTruthy();
      expect(volunteer?.name).toBe('Jane Doe');
      expect(volunteer?.telegram_handle).toBe('@janedoe');
      expect(volunteer?.status).toBe('active');
    });

    it('should return null for non-existent volunteer', async () => {
      const volunteer = await DrizzleDatabaseService.getVolunteerByHandle('@nonexistent');
      expect(volunteer).toBeNull();
    });

    it('should update volunteer status', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('John Smith', '@johnsmith', 'probation');
      expect(volunteer).toBeTruthy();

      const success = await DrizzleDatabaseService.updateVolunteerStatus(volunteer!.id, 'active');
      expect(success).toBe(true);

      const updatedVolunteer = await DrizzleDatabaseService.getVolunteerByHandle('@johnsmith');
      expect(updatedVolunteer?.status).toBe('active');
    });

    it('should increment volunteer commitments', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Alice Johnson', '@alice', 'active');
      expect(volunteer).toBeTruthy();

      const success = await DrizzleDatabaseService.incrementVolunteerCommitments(volunteer!.id);
      expect(success).toBe(true);

      const updatedVolunteer = await DrizzleDatabaseService.getVolunteerByHandle('@alice');
      expect(updatedVolunteer?.commitments).toBe(1);
    });

    it('should increment cumulative_commitments when incrementing commitments', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Bob Smith', '@bobsmith', 'active');
      expect(volunteer).toBeTruthy();
      expect(volunteer?.cumulative_commitments).toBe(0);

      await DrizzleDatabaseService.incrementVolunteerCommitments(volunteer!.id);

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@bobsmith');
      expect(updated?.commitments).toBe(1);
      expect(updated?.cumulative_commitments).toBe(1);
    });

    it('should update both commitments and cumulative_commitments via setVolunteerCommitments', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Carol White', '@carolwhite', 'active');
      expect(volunteer).toBeTruthy();

      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 5);

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@carolwhite');
      expect(updated?.commitments).toBe(5);
      expect(updated?.cumulative_commitments).toBe(5);
    });

    it('should change cumulative_commitments by the same amount when setVolunteerCommitments raises or lowers commitments (for the quarter)', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Dan Carter', '@dancarter', 'active');
      expect(volunteer).toBeTruthy();

      // Set initial commitments: commitments=3, cumulative=3
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 3);

      // New quarter: commitments=0, cumulative=3
      await DrizzleDatabaseService.resetQuarterCommitments(new Date());

      // Increase to 7: delta=+7, so cumulative should become 3+7=10
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 7);

      const afterIncrease = await DrizzleDatabaseService.getVolunteerByHandle('@dancarter');
      expect(afterIncrease?.commitments).toBe(7);
      expect(afterIncrease?.cumulative_commitments).toBe(10);

      // Decrease to 5: delta=-2, so cumulative should become 10-2=8
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 5);

      const afterDecrease = await DrizzleDatabaseService.getVolunteerByHandle('@dancarter');
      expect(afterDecrease?.commitments).toBe(5);
      expect(afterDecrease?.cumulative_commitments).toBe(8);
    });

    it('should get all volunteers', async () => {
      await DrizzleDatabaseService.createVolunteer('User 1', '@user1', 'active');
      await DrizzleDatabaseService.createVolunteer('User 2', '@user2', 'probation');
      await DrizzleDatabaseService.createVolunteer('User 3', '@user3', 'lead');

      const allVolunteers = await DrizzleDatabaseService.getAllVolunteers();
      expect(allVolunteers).toHaveLength(3);
    });
  });

  describe('Event Operations', () => {
    it('should create a new event', async () => {
      const event = await DrizzleDatabaseService.createEvent(
        'Test Workshop',
        '2024-12-01T18:00:00Z',
        'workshop',
        'A test workshop for developers',
        'Tech Hub'
      );

      expect(event).toBeTruthy();
      expect(event?.title).toBe('Test Workshop');
      expect(event?.format).toBe('workshop');
      expect(event?.status).toBe('planning');
      expect(event?.venue).toBe('Tech Hub');
    });

    it('should get event by id', async () => {
      const createdEvent = await DrizzleDatabaseService.createEvent(
        'React Meetup',
        '2024-11-15T19:00:00Z',
        'talk'
      );
      expect(createdEvent).toBeTruthy();

      const event = await DrizzleDatabaseService.getEvent(createdEvent!.id);
      expect(event).toBeTruthy();
      expect(event?.title).toBe('React Meetup');
      expect(event?.format).toBe('talk');
    });

    it('should update event status', async () => {
      const event = await DrizzleDatabaseService.createEvent(
        'Vue Workshop',
        '2024-10-20T17:00:00Z',
        'workshop'
      );
      expect(event).toBeTruthy();

      const success = await DrizzleDatabaseService.updateEventStatus(event!.id, 'published');
      expect(success).toBe(true);

      const updatedEvent = await DrizzleDatabaseService.getEvent(event!.id);
      expect(updatedEvent?.status).toBe('published');
    });

    it('should return only incomplete events from getAllIncompleteEvents', async () => {
      // Create events with different statuses
      const event1 = await DrizzleDatabaseService.createEvent(
        'Incomplete Event 1',
        '2024-10-15T17:00:00Z',
        'workshop',
        'Planning phase',
        'Tech Hub'
      );

      const event2 = await DrizzleDatabaseService.createEvent(
        'Completed Event',
        '2024-09-20T17:00:00Z',
        'talk',
        'Already happened',
        'Conference Center'
      );

      const event3 = await DrizzleDatabaseService.createEvent(
        'Incomplete Event 2',
        '2024-11-30T17:00:00Z',
        'panel',
        'Published event',
        'Online'
      );

      const event4 = await DrizzleDatabaseService.createEvent(
        'Cancelled Event',
        '2024-10-25T17:00:00Z',
        'workshop',
        'Cancelled workshop',
        'Tech Hub'
      );

      // Set event2 as completed
      await DrizzleDatabaseService.updateEventStatus(event2!.id, 'completed');

      // Set event3 as published
      await DrizzleDatabaseService.updateEventStatus(event3!.id, 'published');

      // Set event4 as cancelled
      await DrizzleDatabaseService.updateEventStatus(event4!.id, 'cancelled');

      // Get all incomplete events
      const incompleteEvents = await DrizzleDatabaseService.getPlanningPublishedEvents();

      // Check that only non-completed events are returned
      expect(incompleteEvents).toHaveLength(2);

      // Verify specific events by checking their titles
      const titles = incompleteEvents.map(e => e.title);
      expect(titles).toContain('Incomplete Event 1');
      expect(titles).toContain('Incomplete Event 2');
      expect(titles).not.toContain('Completed Event');
      expect(titles).not.toContain('Cancelled Event');

      // Verify their statuses
      const statuses = incompleteEvents.map(e => e.status);
      expect(statuses).toContain('planning');
      expect(statuses).toContain('published');
      expect(statuses).not.toContain('completed');
      expect(statuses).not.toContain('cancelled');
    });
  });

  describe('Task Operations', () => {
    it('should create a task for an event', async () => {
      const event = await DrizzleDatabaseService.createEvent(
        'Angular Conference',
        '2024-12-10T09:00:00Z',
        'conference'
      );
      expect(event).toBeTruthy();

      const task = await DrizzleDatabaseService.createTask(
        event!.id,
        'Setup registration system',
        'Configure online registration for attendees'
      );

      expect(task).toBeTruthy();
      expect(task?.title).toBe('Setup registration system');
      expect(task?.event_id).toBe(event!.id);
      expect(task?.status).toBe('todo');
    });

    it('should assign volunteer to task', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Task Volunteer', '@taskvolunteer', 'active');
      const event = await DrizzleDatabaseService.createEvent('Test Event', '2024-11-01T18:00:00Z', 'conference');
      const task = await DrizzleDatabaseService.createTask(event!.id, 'Test Task');

      expect(volunteer && event && task).toBeTruthy();

      const success = await DrizzleDatabaseService.assignVolunteerToTask(
        task!.id,
        volunteer!.id
      );
      expect(success).toBe(true);

      const assignments = await DrizzleDatabaseService.getTaskAssignments(task!.id);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].volunteer_id).toBe(volunteer!.id);
    });

    it('should increment commitments and cumulative_commitments when task is set to complete', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Task Completer', '@taskcompleter', 'active');
      const event = await DrizzleDatabaseService.createEvent('Commitment Event', '2024-12-01T18:00:00Z', 'workshop');
      const task = await DrizzleDatabaseService.createTask(event!.id, 'Completable Task');

      await DrizzleDatabaseService.assignVolunteerToTask(task!.id, volunteer!.id);
      await DrizzleDatabaseService.updateTaskStatus(task!.id, 'complete');

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@taskcompleter');
      expect(updated?.commitments).toBe(1);
      expect(updated?.cumulative_commitments).toBe(1);
    });

    it('should not double-count commitments if task is already complete', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('No Double', '@nodouble', 'active');
      const event = await DrizzleDatabaseService.createEvent('No Double Event', '2024-12-01T18:00:00Z', 'workshop');
      const task = await DrizzleDatabaseService.createTask(event!.id, 'Already Done Task');

      await DrizzleDatabaseService.assignVolunteerToTask(task!.id, volunteer!.id);
      await DrizzleDatabaseService.updateTaskStatus(task!.id, 'complete');
      await DrizzleDatabaseService.updateTaskStatus(task!.id, 'complete');

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@nodouble');
      expect(updated?.commitments).toBe(1);
      expect(updated?.cumulative_commitments).toBe(1);
    });

    it('should get tasks for an event', async () => {
      const event = await DrizzleDatabaseService.createEvent('Multi-task Event', '2024-11-05T18:00:00Z', 'workshop');
      expect(event).toBeTruthy();

      await DrizzleDatabaseService.createTask(event!.id, 'Task 1');
      await DrizzleDatabaseService.createTask(event!.id, 'Task 2');
      await DrizzleDatabaseService.createTask(event!.id, 'Task 3');

      const tasks = await DrizzleDatabaseService.getEventTasks(event!.id);
      expect(tasks).toHaveLength(3);
    });
  });

  describe('Commitment Reset Behavior', () => {
    it('should zero commitments but preserve cumulative_commitments on resetMonthlyCommitments', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Dave Brown', '@davebrown', 'active');
      expect(volunteer).toBeTruthy();
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 4);

      await DrizzleDatabaseService.resetMonthlyCommitments();

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@davebrown');
      expect(updated?.commitments).toBe(0);
      expect(updated?.cumulative_commitments).toBe(4);
    });

    it('should zero commitments but preserve cumulative_commitments on resetQuarterCommitments', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Eve Green', '@evegreen', 'active');
      expect(volunteer).toBeTruthy();
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 7);

      await DrizzleDatabaseService.resetQuarterCommitments(new Date());

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@evegreen');
      expect(updated?.commitments).toBe(0);
      expect(updated?.cumulative_commitments).toBe(7);
    });

    it('should accumulate cumulative_commitments correctly after a reset', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Frank Gray', '@frankgray', 'active');
      expect(volunteer).toBeTruthy();
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 5);

      await DrizzleDatabaseService.resetQuarterCommitments(new Date());

      // Mark a new task done after reset
      await DrizzleDatabaseService.incrementVolunteerCommitments(volunteer!.id);

      const updated = await DrizzleDatabaseService.getVolunteerByHandle('@frankgray');
      expect(updated?.commitments).toBe(1);
      expect(updated?.cumulative_commitments).toBe(6);
    });

    it('should preserve cumulative_commitments across multiple quarter resets', async () => {
      const volunteer = await DrizzleDatabaseService.createVolunteer('Grace Lee', '@gracelee', 'active');
      expect(volunteer).toBeTruthy();

      // Q1: volunteer does 7 commitments
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 7);
      await DrizzleDatabaseService.resetQuarterCommitments(new Date());

      // Q2: volunteer does 3 commitments
      await DrizzleDatabaseService.setVolunteerCommitments(volunteer!.id, 3);

      const midQuarter = await DrizzleDatabaseService.getVolunteerByHandle('@gracelee');
      expect(midQuarter?.commitments).toBe(3);
      expect(midQuarter?.cumulative_commitments).toBe(10);

      // After Q2 reset, commitments returns to 0 but cumulative stays at 10
      await DrizzleDatabaseService.resetQuarterCommitments(new Date());

      const afterReset = await DrizzleDatabaseService.getVolunteerByHandle('@gracelee');
      expect(afterReset?.commitments).toBe(0);
      expect(afterReset?.cumulative_commitments).toBe(10);
    });
  });

  describe('Admin Operations', () => {
    it('should add and check admin status', async () => {
      const success = await DrizzleDatabaseService.addAdmin('@admin_test', 'admin');
      expect(success).toBe(true);

      const isAdmin = await DrizzleDatabaseService.isAdmin('@admin_test');
      expect(isAdmin).toBe(true);

      const isNotAdmin = await DrizzleDatabaseService.isAdmin('@regular_user');
      expect(isNotAdmin).toBe(false);
    });

    it('should remove admin', async () => {
      await DrizzleDatabaseService.addAdmin('@temp_admin', 'admin');

      let isAdmin = await DrizzleDatabaseService.isAdmin('@temp_admin');
      expect(isAdmin).toBe(true);

      const success = await DrizzleDatabaseService.removeAdmin('@temp_admin');
      expect(success).toBe(true);

      isAdmin = await DrizzleDatabaseService.isAdmin('@temp_admin');
      expect(isAdmin).toBe(false);
    });
  });

  describe('Status Management', () => {
    it('should generate volunteer status report', async () => {
      await DrizzleDatabaseService.createVolunteerWithStatus('Probation User', '@prob', 'probation');
      await DrizzleDatabaseService.createVolunteerWithStatus('Active User', '@active', 'active');
      await DrizzleDatabaseService.createVolunteerWithStatus('Lead User', '@lead', 'lead');
      await DrizzleDatabaseService.createVolunteerWithStatus('Inactive User', '@inactive', 'inactive');

      const report = await DrizzleDatabaseService.getVolunteerStatusReport();

      expect(report.total).toBe(4);
      expect(report.probation).toHaveLength(1);
      expect(report.active).toHaveLength(1);
      expect(report.lead).toHaveLength(1);
      expect(report.inactive).toHaveLength(1);
    });
  });

  describe('Keep-alive ping', () => {
    it('should report the database as reachable', async () => {
      const isAlive = await DrizzleDatabaseService.pingDatabase();
      expect(isAlive).toBe(true);
    });

    it('should not modify any rows', async () => {
      await DrizzleDatabaseService.createVolunteer('Ping Bystander', '@pingbystander', 'active');
      const before = await DrizzleDatabaseService.getAllVolunteers();

      await DrizzleDatabaseService.pingDatabase();

      const after = await DrizzleDatabaseService.getAllVolunteers();
      expect(after).toEqual(before);
    });
  });
});
