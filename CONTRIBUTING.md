# Contributing to Women Devs SG Volunteer Bot

Thank you for your interest in contributing to the Women Developers SG Volunteer Management Bot! This document provides guidelines and instructions for contributors.

⚠️ **Disclaimer:** While we welcome contributions from everyone around the world, preference will be given to:  
- Women developers based in Singapore  
- Members of the **[WDS Telegram community group](https://t.me/+hh3Fts4oDG41NzQ1)**  

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Bot Commands](#bot-commands)
- [Database Schema](#database-schema)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- A Telegram account for bot testing
- Basic knowledge of TypeScript, Node.js, and SQL

### Development Setup

1. **Fork and Clone the Repository**
   - First, fork this repository to your own GitHub account
   - Then, clone your fork to your local machine:
   ```bash
   git clone https://github.com/your-username/volunteer-telegram-bot.git
   cd volunteer-telegram-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Your Telegram Bot**
   - Follow the [BotFather Setup Guide](./docs/BOTFATHER_SETUP.md) to create your development bot
   - Copy `.env.example` to `.env` and add your bot token

4. **Initialize Local Database**
   ```bash
   npm run setup:local
   ```
   This will:
   - Create a local PGlite database
   - Run migrations
   - Seed sample data

5. **Start Development Server**
   ```bash
   npm run dev:local
   ```

6. **Verify Setup**
   ```bash
   npm test
   npm run lint
   ```

## Project Structure

```
src/
├── commands/           # Bot command handlers
│   ├── admins.ts      # Admin-only commands
│   ├── events.ts      # Event management commands
│   ├── volunteers.ts  # Volunteer commands
│   └── tasks.ts       # Task management commands
├── bot.ts             # Main bot configuration
├── db-drizzle.ts      # Database service layer
├── db-local.ts        # Local PGlite configuration
├── drizzle.ts         # Database connection handler
├── schema.ts          # Database schema definitions
└── migrate.ts         # Database migration runner

scripts/
├── seed-data.ts       # Sample data seeding
└── introspect-db.ts   # Database introspection

tests/
├── setup.ts           # Test configuration
├── database.test.ts   # Database operation tests
└── bot-commands.test.ts # Bot command tests

docs/
└── BOTFATHER_SETUP.md # Bot creation guide
```

## Development Workflow

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Write clean, documented code
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes
```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Check code quality
npm run lint

# Test database operations
npm run setup:local
```

### 4. Manual Testing
- Start the bot: `npm run dev:local`
- Test your changes with your development bot
- Verify both user and admin functionality

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Writing Tests

#### Database Tests
```typescript
import { describe, it, expect } from 'vitest';
import { DrizzleDatabaseService } from '../src/db-drizzle';

describe('Your Feature', () => {
  it('should do something', async () => {
    const result = await DrizzleDatabaseService.someMethod();
    expect(result).toBeTruthy();
  });
});
```

#### Bot Command Tests
```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../src/db-drizzle');

describe('Bot Commands', () => {
  it('should handle command correctly', async () => {
    // Your test implementation
  });
});
```

### Test Data
- Tests use PGlite (in-memory database)
- Each test starts with a clean database
- Use the seeded sample data for consistent testing

## Code Style

### TypeScript Guidelines
- Use strict TypeScript settings
- Prefer interfaces over types for object shapes
- Use proper error handling with try/catch blocks
- Document complex functions with JSDoc comments

### Database Operations
- Always use the `DrizzleDatabaseService` class
- Handle errors gracefully and log them
- Use transactions for multi-step operations
- Validate input parameters

### Bot Commands
- Keep command handlers focused and single-purpose
- Use consistent error messages
- Provide helpful user feedback
- Implement proper authorization checks

### Example Code Style
```typescript
/**
 * Creates a new volunteer with the specified status
 */
async function createVolunteerWithStatus(
  name: string, 
  telegramHandle: string, 
  status: VolunteerStatus
): Promise<Volunteer | null> {
  try {
    const result = await db.insert(volunteers)
      .values({ name, telegram_handle: telegramHandle, status })
      .returning();
    
    return result[0] || null;
  } catch (error) {
    console.error('Error creating volunteer:', error);
    return null;
  }
}
```

## Submitting Changes

### 1. Commit Guidelines
Use conventional commit messages:
```bash
feat: add new volunteer registration command
fix: resolve database connection issue
docs: update setup instructions
test: add tests for event creation
```

### 2. Pre-commit Checklist
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is properly documented
- [ ] Manual testing completed
- [ ] Database migrations work correctly

### 3. Pull Request Process
1. Push your feature branch to your fork
2. Create a pull request targeting the main branch using the provided template
3. Fill out all sections of the PR template
4. Request review from maintainers
5. Address any feedback promptly

## Bot Commands

### User Commands
- `/start` - Register as volunteer or show status
- `/help` - Show available commands
- `/profile` - View volunteer profile
- `/events` - List upcoming events
- `/tasks` - View assigned tasks

### Admin Commands
- `/admin_volunteers` - List all volunteers
- `/admin_events` - Manage events
- `/admin_broadcast` - Send announcements
- `/admin_reports` - Generate reports

### Adding New Commands
1. Create handler in appropriate command file
2. Register command in `bot.ts`
3. Add tests for the command
4. Update documentation
5. Test with both user and admin accounts

## Database Schema

### Core Tables
- `volunteers` - User information and status
- `events` - Community events
- `tasks` - Event-related tasks
- `task_assignments` - Volunteer task assignments
- `admins` - Admin user permissions

### Making Schema Changes
1. Update `src/schema.ts`
2. Generate migration: `npm run db:generate`
3. Test migration locally: `npm run db:migrate:local`
4. Update seed data if needed
5. Add tests for new functionality

## Environment Variables

### Required for Development
```env
BOT_TOKEN=your_bot_token_here
NODE_ENV=development
```

### Optional
```env
ADMIN_SECRET=your_admin_secret
VOLUNTEER_CHANNEL_ID=channel_id
ADMIN_CHANNEL_ID=admin_channel_id
```

## Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check bot token in `.env`
   - Verify bot is running
   - Check console for errors

2. **Database errors**
   - Run `npm run setup:local`
   - Check PGlite installation
   - Verify file permissions

3. **Test failures**
   - Clear `local-db` directory
   - Reinstall dependencies
   - Check for port conflicts

### Getting Help

1. Check existing issues in the repository
2. Review documentation thoroughly
3. Ask questions in community channels
4. Create a detailed issue if needed

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow community guidelines

## Recognition

Contributors will be recognized in:
- Repository contributors list
- Release notes for significant contributions
- Community acknowledgments

Thank you for contributing to the Women Developers SG community! 🚀
