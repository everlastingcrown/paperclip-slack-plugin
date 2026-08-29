import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseIssueStatusUpdate } from "./payloads.js";
import { getPayloadRecord, resolveActorName } from "./utils.js";

export async function handleIssueUpdated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["issue.statusChanged"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const parsed = parseIssueStatusUpdate(event);
  const companyId = event.companyId;
  if (!parsed.ok) {
    await reportEventProcessingError(
      ctx,
      event,
      eventCfg.channels,
      parsed.reason,
      parsed.details,
    );
    return;
  }

  const issue = parsed.value;
  const issueId = issue.id;

  try {
    const newStatus = issue.status;
    if (!newStatus) {
      const payload = getPayloadRecord(event);
      ctx.logger.info("Skipping issue.updated without status for Slack notification", {
        eventId: event.eventId,
        issueId,
        payloadKeys: payload ? Object.keys(payload).sort() : [],
      });
      return;
    }

    const stateKey = "last-status";
    const prevStatus = await ctx.state.get({
      scopeKind: "issue",
      scopeId: issueId,
      stateKey,
    });

    await ctx.state.set(
      { scopeKind: "issue", scopeId: issueId, stateKey },
      newStatus,
    );

    const oldStatus =
      issue.previousStatus ??
      (prevStatus === null || prevStatus === undefined
        ? undefined
        : String(prevStatus));

    if (!oldStatus) {
      return;
    }

    if (oldStatus === newStatus) {
      return;
    }

    const changedBy = await resolveActorName(ctx, event, companyId);
    const issueTitle = issue.title;

    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.issueStatusChanged({
      issueId,
      issueTitle,
      oldStatus,
      newStatus,
      changedBy,
    });

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(
      ctx,
      slack,
      eventCfg.channels,
      message,
      "issue.statusChanged",
      { issueId, oldStatus, newStatus },
    );
  } catch (e: any) {
    ctx.logger.error(
      "Error handling issue.statusChanged (via issue.updated)",
      {
        error: e.message,
        eventId: event.eventId,
        issueId,
      },
    );
  }
}
