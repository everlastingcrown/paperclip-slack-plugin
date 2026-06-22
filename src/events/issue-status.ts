import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import {
  getEventString,
  getIssueSnapshot,
  getPayloadString,
  resolveActorName,
} from "./utils.js";

export async function handleIssueUpdated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["issue.statusChanged"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const issue = getIssueSnapshot(event);
  const issueId =
    issue?.id ??
    getEventString(
      event,
      "issueId",
      "issue.id",
      "data.issue.id",
      "after.id",
      "current.id",
    );
  const companyId = event.companyId;
  if (!issueId) {
    ctx.logger.warn("Could not determine issue ID for issue.updated event", {
      eventId: event.eventId,
    });
    return;
  }

  try {
    const newStatus =
      issue?.status ??
      getPayloadString(
        event,
        "status",
        "newStatus",
        "issue.status",
        "data.issue.status",
        "after.status",
        "current.status",
      );
    if (!newStatus) {
      ctx.logger.warn("Could not determine issue status for issue.updated event", {
        eventId: event.eventId,
        issueId,
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

    if (prevStatus === null || prevStatus === undefined) {
      return;
    }

    const oldStatus = String(prevStatus);

    if (oldStatus === newStatus) {
      return;
    }

    const changedBy = await resolveActorName(ctx, event, companyId);
    const issueTitle =
      issue?.title ??
      getPayloadString(
        event,
        "issueTitle",
        "issue.title",
        "data.issue.title",
        "after.title",
        "current.title",
      ) ??
      `Issue ${issueId}`;

    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.issueStatusChanged({
      issueId,
      issueTitle,
      oldStatus,
      newStatus,
      changedBy,
    });

    const slack = new SlackClient(config.slackBotToken);

    for (const channel of eventCfg.channels) {
      try {
        const resolved = await slack.resolveChannel(channel);
        if (!resolved) {
          ctx.logger.warn("Channel not found for issue.statusChanged", {
            channel,
            issueId,
          });
          continue;
        }
        await slack.postMessage(resolved, message.text, message.blocks);
        ctx.logger.info("Slack notification sent for issue.statusChanged", {
          channel,
          issueId,
          oldStatus,
          newStatus,
        });
      } catch (e: any) {
        ctx.logger.error(
          "Failed to send Slack notification for issue.statusChanged",
          {
            channel,
            error: e.message,
            issueId,
          },
        );
      }
    }
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
