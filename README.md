# Telegram Volunteer Management Bot

A comprehensive Telegram bot built with grammY and Drizzle ORM for managing volunteer onboarding, probation tracking, event planning, and admin management for the Women Developers SG community.

## ✨ Features

### 🎯 Volunteer Management
- **Probation System**: New volunteers must complete 3 commitments within 3 months
- **Automatic Promotion**: Volunteers are automatically promoted to active status when criteria are met
- **Status Tracking**: Track volunteer progress and commitments
- **Inactivity Detection**: Automatically mark volunteers inactive after insufficient commitments
- **Monthly Processing**: Automated monthly status updates and reporting

### 📅 Event Management
- **Interactive Event Creation**: Step-by-step wizard for creating events
- **Task Assignment**: Flexible task management system for events
- **Format Support**: Workshop, Panel, Conference, Talk, Hangout, and more
- **Publishing**: Finalize and publish events with comprehensive tracking

### 🔐 Admin System
- **Secure Authentication**: Admin login with secret key
- **Role-based Access**: Protected admin commands
- **Volunteer Management**: Add, remove, and manage volunteers
- **Event Oversight**: Create and manage events with full task tracking

### 🧪 Developer-Friendly
- **Local Development**: PGlite database for easy local testing
- **Comprehensive Tests**: Full test suite with Vitest
- **Sample Data**: Pre-populated test data for development
- **TypeScript**: Fully typed codebase for better developer experience

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18+ and npm
- Git
- A Telegram account

### 1. Fork and Clone
```bash
git clone https://github.com/your-username/volunteer-telegram-bot.git
cd volunteer-telegram-bot
npm install
```

### 2. Set Up Your Development Bot
Follow our [BotFather Setup Guide](./docs/BOTFATHER_SETUP.md) to create your own test bot.

### 3. Configure Local Environment
```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local and add your bot token
# BOT_TOKEN=your_bot_token_here
# NODE_ENV=development
```

### 4. Initialize Local Database & Start Development
```bash
# Set up local database with sample data (fresh start)
npm run setup:fresh

# OR if you already have a working setup:
npm run setup:local

# Start the bot in development mode
npm run dev:local

# Run tests to verify everything works
npm test
```

### 5. Start Contributing!
- Check out our [Contributing Guide](./CONTRIBUTING.md)
- Browse open issues
- Test the bot with `/start` in Telegram

## 📋 Available Scripts

### Development
```bash
npm run dev:local          # Start bot with local PGlite database
npm run setup:local        # Initialize local DB with sample data
npm run test               # Run test suite
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
npm run lint               # Check code quality
```

### Database Management
```bash
npm run db:migrate:local   # Run migrations on local database
npm run db:seed:local      # Seed local database with sample data
npm run db:studio          # Open Drizzle Studio (database GUI)
```

### Production
```bash
npm run build              # Build for production
npm start                  # Start production server
npm run db:migrate         # Run migrations on production DB
```

## 🏗️ Production Setup

### Prerequisites
- Node.js 18+ 
- Telegram Bot Token (from @BotFather)
- PostgreSQL database (Supabase, Neon, or self-hosted)

### Environment Configuration

```env
# Required
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://username:password@host:port/database
ADMIN_SECRET=your_admin_secret_password
TELEGRAM_BOT_HANDLE=your_bot_handle_without_at

# Optional (broadcasts)
VOLUNTEER_GROUP_ID=your_volunteer_group_id
WEBHOOK_URL=your_vercel_app_URL/api/webhook
```

### Database Setup & Migrations

#### For Initial Setup
```bash
npm run db:generate        # Generate migrations from schema changes
npm run db:migrate         # Run migrations on production DB
```

#### Production Migration Strategy

**Option 1: Safe Migration Process (Recommended)**
```bash
# 1. Generate migration locally after schema changes
npm run db:generate

# 2. Test migration on local copy of production data
NODE_ENV=production npm run db:migrate

# 3. Deploy to staging environment first
# 4. Run migration on production during maintenance window
NODE_ENV=production npm run db:migrate
```

**Option 2: Direct Schema Push (Use with caution)**
```bash
# Only for non-breaking changes in development
npm run db:push
```

#### Migration Best Practices

1. **Always backup production database before migrations**
2. **Test migrations on staging environment first**
3. **Use maintenance windows for breaking changes**
4. **Keep migrations backward compatible when possible**
5. **Review generated SQL before applying to production**

#### Verifying Migrations
```bash
# Check migration status
npm run db:studio          # Visual database inspection
npm run db:introspect      # Generate current schema
```

## Commands Reference

### Volunteer Commands
- `/start` - Welcome message and help
- `/onboard` - Learn about the volunteer program
- `/my_status` - Check your volunteer status and progress
- `/commit <event_id> <role>` - Sign up for a role in an event

### Admin Commands
- `/admin_login <secret>` - Authenticate as admin (one-time setup)
- `/list_volunteers` - View all volunteers and their status
- `/add_volunteer @handle "Full Name"` - Manually add a volunteer
- `/remove_volunteer @handle` - Remove a volunteer
- `/add_volunteer_with_status @handle "Name" <status>` - Add volunteer with specific status
- `/create_event` - Interactive event creation wizard
- `/assign_task <task_id> @volunteer` - Assign volunteer to task
- `/update_task_status <task_id> <status>` - Update task status
- `/monthly_report` - Generate monthly volunteer status report
- `/volunteer_status_report` - View current volunteer status
- `/broadcast` - Show broadcast menu for testing
- `/broadcast_volunteers` - Broadcast volunteer status list to group
- `/broadcast_events` - Broadcast upcoming events to group
- `/broadcast_tasks` - Broadcast available events needing volunteers to group
- `/broadcast_custom <message>` - Send custom broadcast message
- `/finalize_event <event_id>` - Publish event
- `/list_events` - View all events
- `/list_events_with_tasks` - View events with task IDs
- `/event_details <event_id>` - View detailed event information

### Utility Commands
- `/help` - Show help message
- `/cancel` - Cancel current interactive operation

## Event Formats & Required Roles

### Panel Discussion
- Moderator
- Date Confirmation
- Speaker Confirmation
- Pre-event Marketing
- Post-event Marketing

### Workshop
- Facilitator
- Date Confirmation
- Pre-event Marketing
- Post-event Marketing

### Online Events
- Date Confirmation
- Pre-event Marketing
- Post-event Marketing

### In-person Events
- Venue Confirmation
- Date Confirmation
- Pre-event Marketing
- Post-event Marketing

## Volunteer Progression

1. **Probation** (New volunteers)
   - Must complete 3 commitments within 3 months
   - Can sign up for any available roles

2. **Active Volunteer** (Promoted automatically)
   - Completed probation requirements (3 commitments in 3 months)
   - Celebration broadcast sent to volunteer group
   - Full access to all opportunities

3. **Lead Volunteer** (Admin assigned)
   - Senior volunteers with leadership responsibilities
   - Can help with advanced tasks and mentoring

4. **Inactive** (Automatically assigned)
   - Failed to meet 3 commitments in a month
   - Applies to both probation and active volunteers
   - Can be reactivated by admin

## 🗄️ Database Schema

The bot uses 5 main tables:
- **volunteers** - Volunteer information and status tracking
- **events** - Event details and scheduling
- **tasks** - Event-related tasks and assignments
- **task_assignments** - Many-to-many relationship for volunteer task assignments
- **admins** - Admin authentication and permissions

See `src/schema.ts` for complete schema details and Drizzle table definitions.

### Local vs Production Database
- **Local Development**: Uses PGlite (lightweight SQLite-compatible database)
- **Production**: Uses PostgreSQL (Supabase, Neon, or self-hosted)
- **Automatic Switching**: Set `NODE_ENV=development` for local mode

## 🏗️ Project Structure

```
src/
├── bot.ts              # Main bot entry point
├── db-drizzle.ts       # Database service layer with all operations
├── db-local.ts         # PGlite configuration for local development
├── drizzle.ts          # Database connection handler (local/production)
├── schema.ts           # Database schema definitions
├── migrate.ts          # Database migration runner
└── commands/
    ├── volunteers.ts   # Volunteer-related commands
    ├── admins.ts       # Admin commands and authentication
    ├── events.ts       # Event management commands
    └── tasks.ts        # Task management commands

scripts/
├── seed-data.ts        # Sample data for local development
└── introspect-db.ts    # Database introspection utility

tests/
├── setup.ts            # Test environment configuration
├── database.test.ts    # Database operation tests
└── bot-commands.test.ts # Bot command tests

docs/
└── BOTFATHER_SETUP.md  # Guide for creating development bots

.github/
└── pull_request_template.md # PR template for contributors
```

## Maintenance

The bot automatically runs maintenance tasks:

### Hourly Tasks
- Check for volunteer promotions
- Send celebration broadcasts

### Monthly Tasks (1st of each month at 9:00 AM)
- Update volunteer statuses based on commitments
- Mark volunteers inactive if they have < 3 commitments
- Promote probation volunteers to active if they have ≥ 3 commitments
- Reset commitment counters for new month
- Generate monthly status report (logged; not auto-sent to a dedicated admin channel)

### Manual Commands
- `/monthly_report` - Manually trigger monthly processing
- `/volunteer_status_report` - View current status without processing

## Security Notes

- Admin secret should be kept secure and shared only with trusted admins
- Database credentials should be kept secure and never committed to version control
- Bot token should never be committed to version control
- Use environment variables for all sensitive configuration

## 🧪 Testing

The project includes comprehensive tests using Vitest:

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure
- **Database Tests**: Test all database operations and business logic
- **Bot Command Tests**: Mock bot interactions and command handlers
- **Integration Tests**: End-to-end testing with sample data
- **Automatic Setup**: Tests use isolated PGlite instances

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Read the [Contributing Guide](./CONTRIBUTING.md)**
2. **Set up your development environment** (see Quick Start above)
3. **Create a feature branch**: `git checkout -b feature/your-feature`
4. **Make your changes** and add tests
5. **Run the test suite**: `npm test`
6. **Submit a pull request** using our [PR template](./.github/pull_request_template.md)

### What We're Looking For
- 🐛 Bug fixes and improvements
- ✨ New bot commands and features
- 📚 Documentation improvements
- 🧪 Additional test coverage
- 🎨 UI/UX improvements for bot interactions

### Development Workflow
1. Fork the repository
2. Create your development bot using [BotFather Setup Guide](./docs/BOTFATHER_SETUP.md)
3. Set up local environment with `npm run setup:local`
4. Make changes and test with `npm test`
5. Test manually with your bot
6. Submit PR with detailed description

## 📖 Documentation

- [Contributing Guide](./CONTRIBUTING.md) - Detailed contributor instructions
- [BotFather Setup](./docs/BOTFATHER_SETUP.md) - Create your development bot
- [Database Schema](./src/schema.ts) - Complete schema definitions
- [API Documentation](./src/db-drizzle.ts) - Database service methods

## 🔒 Security

- Never commit sensitive data (tokens, passwords, database URLs)
- Use environment variables for all configuration
- Rotate bot tokens regularly
- Use different bots for development and production
- Report security issues privately

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [Women Developers SG](https://www.womendevelopers.sg/) community
- Powered by [grammY](https://grammy.dev/) Telegram Bot Framework
- Database management with [Drizzle ORM](https://orm.drizzle.team/)
- Local development with [PGlite](https://pglite.dev/)
- Testing with [Vitest](https://vitest.dev/)

## 📞 Support

For issues or feature requests:
1. Check existing [issues](https://github.com/Women-Devs-SG/volunteer-telegram-bot/issues)
2. Use Drizzle Studio for database debugging: `npm run db:studio`
3. Check bot logs for error details
4. Create a new issue with detailed information

---

**Made with ❤️ for the Women Developers SG community**
