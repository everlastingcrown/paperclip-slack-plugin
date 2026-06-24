import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseAgentRun } from "./payloads.js";

export async function handleAgentRunFailed(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events["agent.run.failed"];
  if (!eventCfg.enabled || eventCfg.channels.length === 0) return;

  try {
    const parsed = parseAgentRun(event);
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

    const run = parsed.value;
    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.agentRunFailed({
      agentId: run.agentId,
      agentName: run.agentName,
      error: run.error ?? "Unknown error",
      runId: run.runId,
    });

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(ctx, slack, eventCfg.channels, message, "agent.run.failed", {
      agentId: run.agentId,
      runId: run.runId,
    });
  } catch (e: any) {
    ctx.logger.error("Error handling agent.run.failed event", {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
