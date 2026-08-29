import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import type { Block, KnownBlock } from "@slack/types";
import { getConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { SlackFormatter } from "../slack/formatter.js";
import { getPayloadRecord } from "./utils.js";

export interface SlackMessage {
  text: string;
  blocks: (Block | KnownBlock)[];
}

export async function postToChannels(
  ctx: PluginContext,
  slack: SlackClient,
  channels: string[],
  message: SlackMessage,
  logName: string,
  logContext: Record<string, unknown>,
): Promise<void> {
  for (const channel of channels) {
    try {
      const resolved = await slack.resolveChannel(channel);
      if (!resolved) {
        ctx.logger.warn(`Channel not found for ${logName}`, {
          channel,
          ...logContext,
        });
        continue;
      }

      await slack.postMessage(resolved, message.text, message.blocks);
      ctx.logger.info(`Slack notification sent for ${logName}`, {
        channel,
        ...logContext,
      });
    } catch (e: any) {
      ctx.logger.error(`Failed to send Slack notification for ${logName}`, {
        channel,
        error: e.message,
        ...logContext,
      });
    }
  }
}

export async function reportEventProcessingError(
  ctx: PluginContext,
  event: PluginEvent,
  channels: string[],
  reason: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const payload = getPayloadRecord(event);
  const logContext = {
    eventId: event.eventId,
    eventType: event.eventType,
    entityId: event.entityId,
    entityType: event.entityType,
    companyId: event.companyId,
    actorId: event.actorId,
    payloadKeys: payload ? Object.keys(payload).sort() : [],
    reason,
    details,
  };

  ctx.logger.error("Could not process Paperclip event for Slack notification", logContext);

  const config = getConfig();
  const formatter = new SlackFormatter(config.paperclipUrl);
  const message = formatter.eventProcessingError({
    eventId: event.eventId,
    eventType: String(event.eventType),
    reason,
  });

  const slack = new SlackClient(config.slackBotToken);
  await postToChannels(ctx, slack, channels, message, "event.processing_error", {
    eventId: event.eventId,
    eventType: event.eventType,
  });
}
