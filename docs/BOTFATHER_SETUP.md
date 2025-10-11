# Setting Up Your Telegram Bot with BotFather

This guide will walk you through creating a new Telegram bot using BotFather for local development and testing.

## Prerequisites

- A Telegram account
- Access to the Telegram app (mobile or desktop)

## Step-by-Step Setup

### 1. Start a Chat with BotFather

1. Open Telegram and search for `@BotFather`
2. Start a conversation by clicking "Start" or typing `/start`

### 2. Create a New Bot

1. Send the command `/newbot` to BotFather
2. BotFather will ask for a name for your bot. This is the display name users will see.
   ```
   Example: "Women Devs SG Volunteer Bot (Dev)"
   ```
3. Next, BotFather will ask for a username. This must:
   - End with "bot" (e.g., `womendevssg_volunteer_dev_bot`)
   - Be unique across all Telegram bots
   - Contain only letters, numbers, and underscores
   ```
   Example: "womendevssg_volunteer_dev_bot"
   ```

### 3. Get Your Bot Token

After creating the bot, BotFather will provide you with a token that looks like this:
```
123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

**⚠️ Important: Keep this token secure! Never commit it to version control.**

### 4. Configure Your Local Environment

1. Copy the `.env.local.example` file to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit the `.env.local` file and add your bot token:
   ```env
   BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   NODE_ENV=development
   ```

### 5. Set Up Bot Commands (Optional)

You can configure the bot's command menu by sending `/setcommands` to BotFather:

```
start - Register as a volunteer or get your status
help - Show available commands
profile - View your volunteer profile
events - List upcoming events
tasks - View your assigned tasks
```

For admin commands (these won't be visible to regular users):
```
admin_volunteers - List all volunteers
admin_events - Manage events
admin_broadcast - Send announcements
admin_reports - Generate reports
```

### 6. Test Your Bot

1. Start your local development server:
   ```bash
   npm run dev:local
   ```

2. Find your bot on Telegram using the username you created
3. Send `/start` to test the connection
4. You should receive a welcome message if everything is working correctly

## Bot Configuration Options

### Setting Bot Description
```
/setdescription
```
Then send: "A volunteer management bot for Women Developers SG community events and activities."

### Setting Bot About Text
```
/setabouttext
```
Then send: "This bot helps manage volunteers for Women Developers SG events. Use /start to register as a volunteer."

### Setting Bot Profile Picture
1. Send `/setuserpic` to BotFather
2. Upload an image file (preferably 512x512 pixels)

## Development Tips

### Testing Different User Scenarios

1. **Regular User Testing**: Use your personal Telegram account
2. **Admin Testing**: Create a test admin account by adding your handle to the database:
   ```bash
   # After running npm run setup:local
   # The seed data includes @admin_user and @super_admin as test admins
   ```

### Debugging Bot Messages

- Check the console output when running `npm run dev:local`
- Use `console.log()` statements in your bot handlers
- Test commands one by one to isolate issues

### Common Issues

1. **Bot not responding**: 
   - Check if the token is correct in your `.env` file
   - Ensure the bot is running (`npm run dev:local`)
   - Verify your internet connection

2. **Database errors**:
   - Run `npm run setup:local` to initialize the local database
   - Check if PGlite dependencies are installed correctly

3. **Permission errors**:
   - Make sure your Telegram handle matches what's in the database
   - Check admin permissions if testing admin commands

## Security Notes

- Never share your bot token publicly
- Use different bots for development and production
- Regularly rotate your bot tokens
- Don't commit `.env` files to version control

## Next Steps

After setting up your bot:

1. Run the local setup: `npm run setup:local`
2. Test basic commands: `/start`, `/help`, `/profile`
3. Test admin commands if you're an admin user
4. Run the test suite: `npm test`
5. Start contributing to the codebase!

## Getting Help

If you encounter issues:

1. Check the [main README](../README.md) for troubleshooting
2. Review the [Contributing Guidelines](../CONTRIBUTING.md)
3. Open an issue in the repository
4. Ask for help in the community Discord/Slack
