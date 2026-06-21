import type { PluginContext } from "@paperclipai/plugin-sdk";
import { handleIssueCreated } from "./issue-created.js";
import { handleIssueCommentCreated } from "./issue-comment.js";
import { handleIssueUpdated } from "./issue-status.js";
import { handleApprovalCreated, handleApprovalDecided } from "./approval.js";
import { handleAgentRunFailed } from "./agent-error.js";

export function registerAllHandlers(ctx: PluginContext): void {
  ctx.events.on("issue.created", (event) => handleIssueCreated(ctx, event));
  ctx.events.on("issue.comment.created", (event) =>
    handleIssueCommentCreated(ctx, event),
  );
  ctx.events.on("issue.updated", (event) => handleIssueUpdated(ctx, event));
  ctx.events.on("approval.created", (event) =>
    handleApprovalCreated(ctx, event),
  );
  ctx.events.on("approval.decided", (event) =>
    handleApprovalDecided(ctx, event),
  );
  ctx.events.on("agent.run.failed", (event) =>
    handleAgentRunFailed(ctx, event),
  );

  ctx.logger.info("Slack plugin event handlers registered", {
    events: [
      "issue.created",
      "issue.comment.created",
      "issue.updated",
      "approval.created",
      "approval.decided",
      "agent.run.failed",
    ],
  });
}
