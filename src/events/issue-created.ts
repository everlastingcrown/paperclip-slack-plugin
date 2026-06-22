import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { getIssueSnapshot } from "./utils.js";

export async function handleIssueCreated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["issue.created"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const issue = getIssueSnapshot(event);
  if (!issue) {
    ctx.logger.warn("Could not determine issue ID for issue.created event", {
      eventId: event.eventId,
    });
    return;
  }

  const issueId = issue.id;

  try {
    const projectName = issue.projectName ?? issue.projectId;

    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.issueCreated({
      id: issue.id,
      title: issue.title,
      description: issue.description ?? undefined,
      status: issue.status,
      priority: issue.priority,
      projectName,
    });

    const slack = new SlackClient(config.slackBotToken);

    for (const channel of eventCfg.channels) {
      try {
        const resolved = await slack.resolveChannel(channel);
        if (!resolved) {
          ctx.logger.warn("Channel not found for issue.created", {
            channel,
            issueId,
          });
          continue;
        }
        await slack.postMessage(resolved, message.text, message.blocks);
        ctx.logger.info("Slack notification sent for issue.created", {
          channel,
          issueId,
        });
      } catch (e: any) {
        ctx.logger.error(
          "Failed to send Slack notification for issue.created",
          {
            channel,
            error: e.message,
            issueId,
          },
        );
      }
    }
  } catch (e: any) {
    ctx.logger.error("Error handling issue.created event", {
      error: e.message,
      eventId: event.eventId,
      issueId,
    });
  }
}
