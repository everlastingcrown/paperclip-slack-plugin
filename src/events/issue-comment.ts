import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseIssueCommentCreated } from "./payloads.js";
import { resolveActorName } from "./utils.js";

export async function handleIssueCommentCreated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["issue.comment.created"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const companyId = event.companyId;

  try {
    const parsed = parseIssueCommentCreated(event);
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

    const comment = parsed.value;
    const body = await resolveCommentBody(ctx, companyId, comment);
    const author = await resolveActorName(ctx, event, companyId);

    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.issueCommentCreated({
      issueId: comment.issueId,
      issueTitle: comment.issueTitle,
      author,
      body,
    });

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(
      ctx,
      slack,
      eventCfg.channels,
      message,
      "issue.comment.created",
      { issueId: comment.issueId },
    );
  } catch (e: any) {
    ctx.logger.error("Error handling issue.comment.created event", {
      error: e.message,
      eventId: event.eventId,
    });
  }
}

async function resolveCommentBody(
  ctx: PluginContext,
  companyId: string,
  comment: { commentId?: string; issueId: string; body: string },
): Promise<string> {
  if (comment.body.trim()) return comment.body;

  try {
    const comments = await ctx.issues.listComments(comment.issueId, companyId);
    const matched = comment.commentId
      ? comments.find((candidate) => candidate.id === comment.commentId)
      : comments.at(-1);

    return matched?.body ?? "";
  } catch (e: any) {
    ctx.logger.warn("Could not resolve issue comment body", {
      issueId: comment.issueId,
      commentId: comment.commentId,
      companyId,
      error: e.message,
    });
    return "";
  }
}
