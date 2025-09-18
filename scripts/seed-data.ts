import { db } from '../src/drizzle';
import { volunteers, events, tasks, taskAssignments, admins } from '../src/schema';
import dotenv from 'dotenv';

dotenv.config();

async function seedData() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing data (for local development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Clearing existing data...');
      
      // Check if tables exist before trying to delete from them
      try {
        await db.delete(taskAssignments);
      } catch (error) {
        console.log('⚠️ task_assignments table does not exist yet, skipping cleanup');
      }
      
      try {
        await db.delete(tasks);
      } catch (error) {
        console.log('⚠️ tasks table does not exist yet, skipping cleanup');
      }
      
      try {
        await db.delete(events);
      } catch (error) {
        console.log('⚠️ events table does not exist yet, skipping cleanup');
      }
      
      try {
        await db.delete(volunteers);
      } catch (error) {
        console.log('⚠️ volunteers table does not exist yet, skipping cleanup');
      }
      
      try {
        await db.delete(admins);
      } catch (error) {
        console.log('⚠️ admins table does not exist yet, skipping cleanup');
      }
    }

    // Seed admins
    console.log('👑 Creating admin users...');
    const adminUsers = await db.insert(admins).values([
      { telegram_handle: 'admin_user', role: 'admin' },
      { telegram_handle: 'super_admin', role: 'super_admin' },
      { telegram_handle: 'your_telegram_handle', role: 'admin' } // Replace with your actual handle
    ]).returning();

    // Seed volunteers
    console.log('👥 Creating volunteers...');
    const volunteerUsers = await db.insert(volunteers).values([
      {
        name: 'Alice Johnson',
        telegram_handle: 'alice_dev',
        status: 'active',
        commitments: 5,
        probation_start_date: new Date('2024-01-15')
      },
      {
        name: 'Bob Smith',
        telegram_handle: 'bob_coder',
        status: 'lead',
        commitments: 8,
        probation_start_date: new Date('2023-11-01')
      },
      {
        name: 'Carol Wilson',
        telegram_handle: 'carol_tech',
        status: 'probation',
        commitments: 1,
        probation_start_date: new Date('2024-08-01')
      },
      {
        name: 'David Chen',
        telegram_handle: 'david_js',
        status: 'active',
        commitments: 4,
        probation_start_date: new Date('2024-02-10')
      },
      {
        name: 'Eva Rodriguez',
        telegram_handle: 'eva_python',
        status: 'inactive',
        commitments: 0,
        probation_start_date: new Date('2024-03-20')
      }
    ]).returning();

    // Seed events
    console.log('📅 Creating events...');
    const eventList = await db.insert(events).values([
      {
        title: 'React Workshop: Building Modern UIs',
        date: new Date('2025-12-15T18:00:00Z'),
        format: 'workshop',
        status: 'planning',
        venue: 'Tech Hub Singapore',
        details: 'Hands-on workshop covering React hooks, state management, and modern development practices.',
        created_by: volunteerUsers[1].id // Bob (lead)
      },
      {
        title: 'Women in Tech Panel Discussion',
        date: new Date('2025-11-02T19:00:00Z'),
        format: 'panel',
        status: 'published',
        venue: 'Online (Zoom)',
        details: 'Panel discussion featuring successful women in technology sharing their experiences and insights.',
        created_by: volunteerUsers[0].id // Alice
      },
      {
        title: 'JavaScript Fundamentals Talk',
        date: new Date('2025-12-28T17:30:00Z'),
        format: 'talk',
        status: 'planning',
        venue: 'NUS School of Computing',
        details: 'Introduction to JavaScript fundamentals for beginners.',
        created_by: volunteerUsers[3].id // David
      },
      {
        title: 'Monthly Community Hangout',
        date: new Date('2025-12-30T20:00:00Z'),
        format: 'hangout',
        status: 'planning',
        venue: 'Clarke Quay Central',
        details: 'Casual networking event for community members to connect and share experiences.',
        created_by: volunteerUsers[1].id // Bob
      },
      {
        title: 'AI/ML Conference 2024',
        date: new Date('2026-01-15T09:00:00Z'),
        format: 'conference',
        status: 'planning',
        venue: 'Marina Bay Sands Convention Centre',
        details: 'Full-day conference featuring talks on artificial intelligence and machine learning.',
        created_by: volunteerUsers[0].id // Alice
      }
    ]).returning();

    // Seed tasks
    console.log('📋 Creating tasks...');
    const taskList = await db.insert(tasks).values([
      // React Workshop tasks
      {
        event_id: eventList[0].id,
        title: 'Prepare workshop materials',
        description: 'Create slides, code examples, and hands-on exercises for the React workshop.',
        status: 'in_progress'
      },
      {
        event_id: eventList[0].id,
        title: 'Set up development environment',
        description: 'Prepare laptops and ensure all necessary software is installed.',
        status: 'todo'
      },
      {
        event_id: eventList[0].id,
        title: 'Coordinate with venue',
        description: 'Confirm room setup, AV equipment, and catering arrangements.',
        status: 'todo'
      },
      
      // Panel Discussion tasks
      {
        event_id: eventList[1].id,
        title: 'Recruit panelists',
        description: 'Reach out to and confirm participation of 4-5 women tech leaders.',
        status: 'complete'
      },
      {
        event_id: eventList[1].id,
        title: 'Prepare discussion questions',
        description: 'Create engaging questions for the panel discussion.',
        status: 'complete'
      },
      {
        event_id: eventList[1].id,
        title: 'Test Zoom setup',
        description: 'Ensure all technical aspects of the online event are working properly.',
        status: 'in_progress'
      },
      
      // Community Hangout tasks
      {
        event_id: eventList[3].id,
        title: 'Book venue',
        description: 'Reserve space at Clarke Quay Central for the hangout.',
        status: 'todo'
      },
      {
        event_id: eventList[3].id,
        title: 'Create event promotion materials',
        description: 'Design social media posts and event descriptions.',
        status: 'todo'
      },
      
      // AI/ML Conference tasks
      {
        event_id: eventList[4].id,
        title: 'Secure keynote speakers',
        description: 'Reach out to industry leaders for keynote presentations.',
        status: 'in_progress'
      },
      {
        event_id: eventList[4].id,
        title: 'Design conference website',
        description: 'Create a professional website with schedule, speakers, and registration.',
        status: 'todo'
      }
    ]).returning();

    // Seed task assignments
    console.log('🎯 Assigning tasks to volunteers...');
    await db.insert(taskAssignments).values([
      // Alice's assignments
      { task_id: taskList[0].id, volunteer_id: volunteerUsers[0].id, assigned_by: volunteerUsers[1].id },
      { task_id: taskList[3].id, volunteer_id: volunteerUsers[0].id, assigned_by: volunteerUsers[1].id },
      { task_id: taskList[8].id, volunteer_id: volunteerUsers[0].id, assigned_by: volunteerUsers[1].id },
      
      // Bob's assignments (as lead)
      { task_id: taskList[1].id, volunteer_id: volunteerUsers[1].id, assigned_by: volunteerUsers[1].id },
      { task_id: taskList[6].id, volunteer_id: volunteerUsers[1].id, assigned_by: volunteerUsers[1].id },
      
      // Carol's assignments (probation)
      { task_id: taskList[7].id, volunteer_id: volunteerUsers[2].id, assigned_by: volunteerUsers[1].id },
      
      // David's assignments
      { task_id: taskList[2].id, volunteer_id: volunteerUsers[3].id, assigned_by: volunteerUsers[1].id },
      { task_id: taskList[4].id, volunteer_id: volunteerUsers[3].id, assigned_by: volunteerUsers[0].id },
      { task_id: taskList[5].id, volunteer_id: volunteerUsers[3].id, assigned_by: volunteerUsers[0].id },
      { task_id: taskList[9].id, volunteer_id: volunteerUsers[3].id, assigned_by: volunteerUsers[0].id }
    ]);

    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${adminUsers.length} admin users created`);
    console.log(`   - ${volunteerUsers.length} volunteers created`);
    console.log(`   - ${eventList.length} events created`);
    console.log(`   - ${taskList.length} tasks created`);
    console.log(`   - Task assignments completed`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedData().then(() => {
    console.log('🎉 Seeding process finished!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
}

export { seedData };
