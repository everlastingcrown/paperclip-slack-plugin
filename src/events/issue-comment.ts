import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
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
    const payload = event.payload as Record<string, unknown> | undefined;
    const issueId =
      (payload?.issueId as string) ?? ((payload as any)?.issue?.id as string);
    const commentBody =
      (payload?.body as string) ?? (payload?.content as string) ?? "";

    if (!issueId) {
      ctx.logger.warn(
        "Could not determine issue ID for issue.comment.created event",
        { eventId: event.eventId },
      );
      return;
    }

    let issueTitle = "Unknown issue";
    try {
      const issue = await ctx.issues.get(issueId, companyId);
      if (issue) {
        issueTitle = issue.title;
      }
    } catch {
      // fallback to default
    }

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
