import { MiddlewareFn } from "grammy";
import { logAdminAction } from '../adminAuditLogService'

export function loggedAdminCommand(commandName: string, handler: MiddlewareFn<any>) {
  return async (ctx: any, next: any) => {
    try {
      await handler(ctx, next);
      await logAdminAction(ctx, { command: commandName, argsRaw: ctx.match }, { success: true });
    } catch (err: any) {
      await logAdminAction(ctx, { command: commandName, argsRaw: ctx.match }, { success: false, errorMessage: err.message });
      throw err;
    }
  };
}
