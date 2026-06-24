import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseIssueLifecycle } from "./payloads.js";
import { resolveActorName } from "./utils.js";

export async function handleIssueCheckedOut(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  await handleIssueLifecycle(ctx, event, "issue.checked_out", "checked_out");
}

export async function handleIssueReleased(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  await handleIssueLifecycle(ctx, event, "issue.released", "released");
}

async function handleIssueLifecycle(
  ctx: PluginContext,
  event: PluginEvent,
  eventKey: "issue.checked_out" | "issue.released",
  lifecycleEvent: "checked_out" | "released",
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events[eventKey];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  try {
    const parsed = parseIssueLifecycle(event);
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
    const actor = await resolveActorName(ctx, event, event.companyId);
    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.issueLifecycle({
      issueId: issue.id,
      issueTitle: issue.title,
      actor,
      event: lifecycleEvent,
    });

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(ctx, slack, eventCfg.channels, message, eventKey, {
      issueId: issue.id,
    });
  } catch (e: any) {
    ctx.logger.error(`Error handling ${eventKey} event`, {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
