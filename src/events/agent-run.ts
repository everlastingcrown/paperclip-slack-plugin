import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { postToChannels, reportEventProcessingError } from "./delivery.js";
import { parseAgentRun } from "./payloads.js";
import { resolveAgentName } from "./utils.js";

export async function handleAgentRunFinished(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  await handleAgentRunStatus(ctx, event, "agent.run.finished", "finished");
}

export async function handleAgentRunCancelled(
  ctx: PluginContext,
  event: PluginEvent,
): Promise<void> {
  await handleAgentRunStatus(ctx, event, "agent.run.cancelled", "cancelled");
}

async function handleAgentRunStatus(
  ctx: PluginContext,
  event: PluginEvent,
  eventKey: "agent.run.finished" | "agent.run.cancelled",
  status: "finished" | "cancelled",
): Promise<void> {
  const config = getConfig();
  const eventCfg = config.events[eventKey];
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
    const agentName = await resolveAgentName(
      ctx,
      event,
      event.companyId,
      run.agentId,
      run.agentName,
    );
    const formatter = new SlackFormatter(config.paperclipUrl);
    const message = formatter.agentRunStatus({
      agentId: run.agentId,
      agentName,
      runId: run.runId,
      status,
    });

    const slack = new SlackClient(config.slackBotToken);
    await postToChannels(ctx, slack, eventCfg.channels, message, eventKey, {
      agentId: run.agentId,
      runId: run.runId,
    });
  } catch (e: any) {
    ctx.logger.error(`Error handling ${eventKey} event`, {
      error: e.message,
      eventId: event.eventId,
    });
  }
}
