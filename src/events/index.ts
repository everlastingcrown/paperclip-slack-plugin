import type { PluginContext } from "@paperclipai/plugin-sdk";
import { handleIssueCreated } from "./issue-created.js";
import { handleIssueCommentCreated } from "./issue-comment.js";
import { handleIssueCheckedOut, handleIssueReleased } from "./issue-lifecycle.js";
import { handleIssueUpdated } from "./issue-status.js";
import { handleApprovalCreated, handleApprovalDecided } from "./approval.js";
import { handleAgentRunCancelled, handleAgentRunFinished } from "./agent-run.js";
import { handleAgentRunFailed } from "./agent-error.js";
import {
  handleBudgetIncidentOpened,
  handleBudgetIncidentResolved,
} from "./budget-incident.js";

export function registerAllHandlers(ctx: PluginContext): void {
  ctx.events.on("issue.created", (event) => handleIssueCreated(ctx, event));
  ctx.events.on("issue.comment.created", (event) =>
    handleIssueCommentCreated(ctx, event),
  );
  ctx.events.on("issue.updated", (event) => handleIssueUpdated(ctx, event));
  ctx.events.on("issue.checked_out", (event) =>
    handleIssueCheckedOut(ctx, event),
  );
  ctx.events.on("issue.released", (event) => handleIssueReleased(ctx, event));
  ctx.events.on("approval.created", (event) =>
    handleApprovalCreated(ctx, event),
  );
  ctx.events.on("approval.decided", (event) =>
    handleApprovalDecided(ctx, event),
  );
  ctx.events.on("agent.run.finished", (event) =>
    handleAgentRunFinished(ctx, event),
  );
  ctx.events.on("agent.run.cancelled", (event) =>
    handleAgentRunCancelled(ctx, event),
  );
  ctx.events.on("agent.run.failed", (event) =>
    handleAgentRunFailed(ctx, event),
  );
  ctx.events.on("budget.incident.opened", (event) =>
    handleBudgetIncidentOpened(ctx, event),
  );
  ctx.events.on("budget.incident.resolved", (event) =>
    handleBudgetIncidentResolved(ctx, event),
  );

  ctx.logger.info("Slack plugin event handlers registered", {
    events: [
      "issue.created",
      "issue.comment.created",
      "issue.updated",
      "issue.checked_out",
      "issue.released",
      "approval.created",
      "approval.decided",
      "agent.run.finished",
      "agent.run.cancelled",
      "agent.run.failed",
      "budget.incident.opened",
      "budget.incident.resolved",
    ],
  });
}
