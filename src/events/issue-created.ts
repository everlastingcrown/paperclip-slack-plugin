import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseIssueCreated } from "./payloads.js";

export async function handleIssueCreated(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["issue.created"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  const parsed = parseIssueCreated(event);
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
    await postToChannels(ctx, slack, eventCfg.channels, message, "issue.created", {
      issueId,
    });
  } catch (e: any) {
    ctx.logger.error("Error handling issue.created event", {
      error: e.message,
      eventId: event.eventId,
      issueId,
    });
  }
}
