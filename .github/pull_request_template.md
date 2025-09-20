# Pull Request

## Description
<!-- Provide a brief description of what this PR does -->

## Type of Change
<!-- Mark the relevant option with an "x" -->
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🧹 Code cleanup/refactoring
- [ ] ⚡ Performance improvement
- [ ] 🔧 Configuration change
- [ ] 🧪 Test addition/improvement

## Related Issue
<!-- Link to the issue this PR addresses -->
Fixes #(issue number)

## Changes Made
<!-- List the specific changes made in this PR -->
- 
- 
- 

## Testing
<!-- Describe the tests you ran to verify your changes -->
- [ ] I have run `npm test` and all tests pass
- [ ] I have run `npm run lint` and there are no linting errors
- [ ] I have tested the bot commands manually in development
- [ ] I have verified the database operations work correctly
- [ ] I have aligned `api/webhook.ts` with `src/bot.ts` for new commands/handlers (Vercel parity)
- [ ] I have run `npm run check:parity` and resolved any mismatches

### Test Commands Run
```bash
# List the specific commands you ran to test
npm test
npm run lint
npm run setup:local
```

## Database Changes
<!-- If this PR includes database schema changes -->
- [ ] No database changes
- [ ] Database migration included
- [ ] Sample data updated
- [ ] Migration tested locally

## Bot Commands Affected
<!-- List any bot commands that are new, modified, or removed -->
- [ ] No command changes
- [ ] New commands: 
- [ ] Modified commands: 
- [ ] Removed commands: 

## Checklist
<!-- Mark completed items with an "x" -->
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
 - [ ] Help text and command auto-complete updated in both `src/bot.ts` and `api/webhook.ts`

## Screenshots/Demo
<!-- If applicable, add screenshots or demo GIFs to help explain your changes -->

## Additional Notes
<!-- Add any additional notes, concerns, or context for reviewers -->

## Reviewer Guidelines
<!-- For reviewers -->
### Testing Steps
1. Pull the branch locally
2. Run `npm install` to ensure dependencies are up to date
3. Run `npm run setup:local` to set up the local database
4. Run `npm test` to verify all tests pass
5. Test the bot functionality manually if applicable

### Review Focus Areas
- [ ] Code quality and adherence to project standards
- [ ] Test coverage for new functionality
- [ ] Documentation updates
- [ ] Database migration safety (if applicable)
- [ ] Bot command functionality and user experience
