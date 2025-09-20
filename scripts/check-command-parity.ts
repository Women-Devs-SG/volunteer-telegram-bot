import fs from 'fs';
import path from 'path';

function extractCommands(filePath: string): Set<string> {
  const src = fs.readFileSync(filePath, 'utf8');
  const cmdRegex = /bot\.command\(\s*'([^']+)'/g;
  const commands = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = cmdRegex.exec(src)) !== null) {
    commands.add(m[1]);
  }
  return commands;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const botPath = path.join(repoRoot, 'src', 'bot.ts');
  const webhookPath = path.join(repoRoot, 'api', 'webhook.ts');

  if (!fs.existsSync(botPath) || !fs.existsSync(webhookPath)) {
    console.error('Unable to locate src/bot.ts or api/webhook.ts');
    process.exit(2);
  }

  const botCmds = extractCommands(botPath);
  const webhookCmds = extractCommands(webhookPath);

  const missingInWebhook = [...botCmds].filter(c => !webhookCmds.has(c)).sort();
  const extraInWebhook = [...webhookCmds].filter(c => !botCmds.has(c)).sort();

  const ok = missingInWebhook.length === 0 && extraInWebhook.length === 0;

  if (ok) {
    console.log('✅ Command parity OK between src/bot.ts and api/webhook.ts');
    console.log('Commands:', [...botCmds].sort().join(', '));
    process.exit(0);
  } else {
    console.log('❌ Command parity mismatch found.');
    if (missingInWebhook.length > 0) {
      console.log('\nCommands present in src/bot.ts but MISSING in api/webhook.ts:');
      missingInWebhook.forEach(c => console.log('  -', c));
    }
    if (extraInWebhook.length > 0) {
      console.log('\nCommands present in api/webhook.ts but NOT in src/bot.ts:');
      extraInWebhook.forEach(c => console.log('  -', c));
    }
    console.log('\nPlease align api/webhook.ts with src/bot.ts.');
    process.exit(1);
  }
}

main();
