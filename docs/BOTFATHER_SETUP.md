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
   ADMIN_SECRET=your_own_local_test_secret
   ```

   Choose your own private `ADMIN_SECRET` for testing admin access. This is separate from the bot token supplied by BotFather. Restart the bot after changing `.env.local`.

### 5. Set Up Bot Commands (Optional)

The local bot automatically registers its command menu when it starts. You can also configure a menu manually by sending `/setcommands` to BotFather and selecting your development bot:

```
start - Show welcome message and help
help - Show available commands
onboard - Learn about the volunteer program
my_status - Check your volunteer status
list_events - List planning & published events
my_tasks - View your assigned tasks
```

Examples of admin commands:
```
list_volunteers - List all volunteers
add_volunteer - Add a volunteer
broadcast - Show the broadcast menu
volunteer_status_report - View current volunteer status
```

The automatically registered menu includes admin commands visible to regular users, but the bot checks admin permissions before allowing their use. Adding a command to the menu does not grant access.

### 6. Test Your Bot

1. From the cloned repository, install dependencies with `npm install` if you have not already done so. For first-time setup, initialize the local database:
   ```bash
   npm run setup:local
   ```

   With `NODE_ENV=development`, the bot uses PGlite locally; no external database is needed. This command migrates the database, clears existing local data, and inserts sample data, including placeholder admins. Do not run it each time you start the bot.

2. Start your local development bot:
   ```bash
   npm run dev:local
   ```

3. Find your bot on Telegram using the username you created
4. Send `/start` to test the connection
5. You should receive a welcome message if everything is working correctly

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
2. **Admin Testing**:
   - Set a username on your personal Telegram account in Telegram settings.
   - Set your own `ADMIN_SECRET` in `.env.local` as described in Step 4, then start or restart the development bot.
   - In a private chat with your development bot (not BotFather), send the following, replacing `<your-secret>` with the exact value of `ADMIN_SECRET`:
   ```text
   /admin_login <your-secret>
   ```
   - After receiving the admin-access confirmation, send `/list_volunteers` to test an admin command.

   Successful login stores your Telegram username in the local admins table. The seeded `admin_user` and `super_admin` handles are examples; they do not grant your personal account access. Rerunning `npm run setup:local` clears admin registrations, so log in again afterward. Anyone who knows the secret can use it to obtain admin access to this bot; keep it private.

### Debugging Bot Messages

- Check the console output when running `npm run dev:local`
- Use `console.log()` statements in your bot handlers
- Test commands one by one to isolate issues

### Common Issues

1. **Bot not responding**: 
   - Check if the token is correct in your `.env.local` file
   - Ensure the bot is running (`npm run dev:local`)
   - Verify your internet connection

2. **Database errors**:
   - Run `npm run setup:local` to initialize the local database
   - This clears and reseeds local data, including admin registrations; use it only when you intend to initialize or reseed your development database
   - Check if PGlite dependencies are installed correctly

3. **Permission errors**:
   - Make sure your Telegram account has a username
   - Follow [Admin Testing](#testing-different-user-scenarios) to register your username using `/admin_login <your-secret>`
   - If you receive "Invalid admin secret", check that the supplied value matches `ADMIN_SECRET` in `.env.local` and restart the bot after changing that file

## Security Notes

- Never share your bot token publicly
- Use different bots for development and production
- Regularly rotate your bot tokens
- Don't commit `.env` files to version control

## Next Steps

After setting up your bot:

1. Test basic commands: `/start`, `/help`, `/my_status`, `/list_events`, `/my_tasks`
2. Follow [Admin Testing](#testing-different-user-scenarios) and test `/list_volunteers`
3. Run the test suite: `npm test`
4. Start contributing to the codebase!

## Getting Help

If you encounter issues:

1. Check the [main README](../README.md) for troubleshooting
2. Review the [Contributing Guidelines](../CONTRIBUTING.md)
3. Open an issue in the repository
4. Ask for help in the community Discord/Slack
