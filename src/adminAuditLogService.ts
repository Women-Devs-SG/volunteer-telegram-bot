import { db } from './drizzle'
import { adminAuditLogs } from './schema'
export async function logAdminAction(
  ctx: any,
  details: { command: string; argsRaw?: string; metadata?: any },
  result: { success: boolean; errorMessage?: string }
) {
  const adminHandle =
    (ctx.from?.username ??
    `${ctx.from?.first_name ?? ''} ${ctx.from?.last_name ?? ''}`.trim()) ||
    'unknown';

  const adminTelegramId = ctx.from?.id?.toString() ?? 'unknown';
  const chatId = ctx.chat?.id?.toString() ?? 'unknown';
  const messageId = ctx.message?.message_id?.toString() ?? 'unknown';

  const maskedArgs = details.argsRaw ?? '';
  console.log(`Logging admin action: ${adminHandle} executed /${details.command} ${maskedArgs} - ${result.success ? 'success' : 'failure'}`);

  try {
    await db.insert(adminAuditLogs).values({
      admin_handle: adminHandle,
      admin_telegram_id: adminTelegramId,
      chat_id: chatId,
      message_id: messageId,
      command: details.command,
      args_raw: maskedArgs,
      result: result.success ? 'success' : 'failure',
      error_message: result.errorMessage ?? null,
      metadata: details.metadata ?? {},
    });
  } catch (e) {
    console.error('Failed to log admin action:', e);
  }
}
