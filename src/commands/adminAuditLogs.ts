import { db } from "../drizzle";
import { adminAuditLogs } from "../schema";
import { CommandContext } from "grammy";
import { eq, gte, desc } from "drizzle-orm"; // for filtering

interface AuditLogsArgs {
  since?: string;
  command?: string;
  handle?: string;
  limit?: number;
}

export const auditLogsCommand = async (ctx: CommandContext<any>) => {
  try {
    const args = ctx.match?.split(" ").filter(Boolean) ?? [];
    const parsed: AuditLogsArgs = {};

    for (const arg of args) {
      if (/^\d{4}-\d{2}-\d{2}/.test(arg)) parsed.since = arg; // date filter
      else if (arg.startsWith("@")) parsed.handle = arg.slice(1);
      else if (/^\d+$/.test(arg)) parsed.limit = parseInt(arg, 10);
      else parsed.command = arg;
    }

    const limit = parsed.limit ?? 20;

    const whereClauses = [];
    if (parsed.since) {
      whereClauses.push(gte(adminAuditLogs.timestamp, new Date(parsed.since)));
    }
    if (parsed.command) {
      whereClauses.push(eq(adminAuditLogs.command, parsed.command));
    }
    if (parsed.handle) {
      whereClauses.push(eq(adminAuditLogs.admin_handle, parsed.handle));
    }

    let query = db.select().from(adminAuditLogs);
    if (whereClauses.length > 0) {
      query = query.where(...whereClauses);
    }
    query = query.orderBy(desc(adminAuditLogs.timestamp)).limit(limit);

    const logs = await query;

    if (!logs.length) {
      await ctx.reply("📜 No admin audit logs found with the given filters.");
      return;
    }

    const formatted = logs
      .map(
        (log: any) =>
          `👤 ${
            log.admin_handle ?? "unknown"
          } | ⏰ ${log.timestamp.toISOString()}\n` +
          `💬 /${log.command} ${log.args_raw ?? ""}\n` +
          `${
            log.result === "success"
              ? "✅ success"
              : `❌ failure: ${log.error_message ?? ""}`
          }`
      )
      .join("\n\n");

    await ctx.reply(`📜 Latest Admin Audit Logs\n\n${formatted}`);
  } catch (err: any) {
    console.error("Error fetching audit logs:", err);
    await ctx.reply("⚠️ Failed to fetch audit logs. Please try again later.");
  }
};
