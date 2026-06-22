import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { getPayloadRecord, getPayloadString, resolveActorName } from "./utils.js";

export async function handleIssueCommentCreated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["issue.comment.created"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const companyId = event.companyId;

  try {
    const eventIssueId =
      event.entityType === "issue" ? event.entityId : undefined;
    const issueId =
      eventIssueId ??
      getPayloadString(
        event,
        "issueId",
        "issue_id",
        "parentIssueId",
        "issue.id",
        "data.issue.id",
        "comment.issueId",
        "comment.issue_id",
        "data.comment.issueId",
        "data.comment.issue_id",
        "comment.issue.id",
        "issueComment.issueId",
        "issueComment.issue_id",
        "issueComment.issue.id",
        "parentIssue.id",
        "parent.id",
        "target.issueId",
        "target.issue_id",
        "target.issue.id",
        "target.id",
      );
    const commentBody =
      getPayloadString(
        event,
        "body",
        "content",
        "text",
        "comment.body",
        "comment.content",
        "comment.text",
        "comment.message",
        "comment.markdown",
        "data.comment.body",
        "data.comment.content",
        "data.comment.text",
        "data.comment.message",
        "data.comment.markdown",
        "issueComment.body",
        "issueComment.content",
        "issueComment.text",
        "issueComment.message",
        "issueComment.markdown",
      ) ?? "";

    if (!issueId) {
      const payload = getPayloadRecord(event);
      ctx.logger.warn(
        "Could not determine issue ID for issue.comment.created event",
        {
          eventId: event.eventId,
          entityId: event.entityId,
          entityType: event.entityType,
          payloadKeys: payload ? Object.keys(payload).sort() : [],
        },
      );
      return;
    }

    const issueTitle =
      getPayloadString(
        event,
        "issueTitle",
        "issue.title",
        "data.issue.title",
        "comment.issue.title",
      ) ?? `Issue ${issueId}`;

    const author = await resolveActorName(ctx, event, companyId);

    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.issueCommentCreated({
      issueId,
      issueTitle,
      author,
      body: commentBody,
    });

    const slack = new SlackClient(config.slackBotToken);

    for (const channel of eventCfg.channels) {
      try {
        const resolved = await slack.resolveChannel(channel);
        if (!resolved) {
          ctx.logger.warn("Channel not found for issue.comment.created", {
            channel,
            issueId,
          });
          continue;
        }
        await slack.postMessage(resolved, message.text, message.blocks);
        ctx.logger.info("Slack notification sent for issue.comment.created", {
          channel,
          issueId,
        });
      } catch (e: any) {
        ctx.logger.error(
          "Failed to send Slack notification for issue.comment.created",
          { channel, error: e.message, issueId },
        );
      }
    }
  } catch (e: any) {
    ctx.logger.error("Error handling issue.comment.created event", {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
