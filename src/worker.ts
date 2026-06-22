import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginHealthDiagnostics,
  type PluginConfigValidationResult,
} from "@paperclipai/plugin-sdk";
import { setConfig, getConfig } from "./config.js";
import { registerAllHandlers } from "./events/index.js";
import { SlackClient } from "./slack/client.js";
import type { PluginConfig, EventKey } from "./types.js";

async function validateFullConfig(
  config: PluginConfig,
): Promise<string[]> {
  const errors: string[] = [];

  if (!config.slackBotToken || config.slackBotToken.trim() === "") {
    errors.push("Slack Bot Token is required.");
    return errors;
  }

  if (!config.slackBotToken.startsWith("xoxb-")) {
    errors.push(
      "Token must be a Bot OAuth token starting with xoxb-. Bot tokens are found at https://api.slack.com/apps under OAuth & Permissions.",
    );
    return errors;
  }

  let slack: SlackClient;
  try {
    slack = new SlackClient(config.slackBotToken);
  } catch (e: any) {
    errors.push(`Failed to initialize Slack client: ${e.message}`);
    return errors;
  }

  try {
    const authResult = await slack.authTest();
    if (!authResult.ok) {
      errors.push("Slack authentication failed. Check that the token is valid and not revoked.");
      return errors;
    }
  } catch (e: any) {
    errors.push(
      `Slack authentication failed: ${e.message}. Verify the token is correct and the bot has access to the workspace.`,
    );
    return errors;
  }

  try {
    const publicChannels = await slack.listChannels("public_channel");
    let privateChannels: Awaited<ReturnType<SlackClient["listChannels"]>> | null = null;
    const configEvents = config.events;

    for (const eventKey of Object.keys(configEvents) as EventKey[]) {
      const eventCfg = configEvents[eventKey];
      if (!eventCfg || !eventCfg.enabled) continue;
      if (!eventCfg.channels || eventCfg.channels.length === 0) continue;

      for (const channel of eventCfg.channels) {
        if (/^[CG][A-Z0-9]+$/.test(channel)) {
          continue;
        }

        const cleanName = channel.replace(/^#/, "");
        const foundPublic = publicChannels.some(
          (ch) => ch.name.toLowerCase() === cleanName.toLowerCase(),
        );
        if (foundPublic) continue;

        if (privateChannels === null) {
          try {
            privateChannels = await slack.listChannels("private_channel");
          } catch (e: any) {
            errors.push(
              `events.${eventKey}.channels: Channel "#${cleanName}" was not found in the public channels list. If this is a private channel, grant the bot groups:read and invite it to the channel, or configure the Slack channel ID.`,
            );
            continue;
          }
        }

        const foundPrivate = privateChannels.some(
          (ch) => ch.name.toLowerCase() === cleanName.toLowerCase(),
        );

        if (!foundPrivate) {
          errors.push(
            `events.${eventKey}.channels: Channel "#${cleanName}" was not found in the workspace channels visible to this bot. Check the channel name and ensure the bot has been invited to private channels.`,
          );
        }
      }
    }
  } catch (e: any) {
    errors.push(
      `Could not verify public channels: ${e.message}. Ensure the bot has the channels:read scope.`,
    );
  }

  return errors;
}

const plugin = definePlugin({
  async setup(ctx: PluginContext): Promise<void> {
    const rawConfig = (await ctx.config.get()) as Record<string, unknown>;
    setConfig({
      slackBotToken: (rawConfig.slackBotToken as string) ?? "",
      paperclipUrl:
        (rawConfig.paperclipUrl as string) || "http://localhost:3100",
      events: rawConfig.events as PluginConfig["events"] | undefined,
    });

    registerAllHandlers(ctx);

    const config = getConfig();
    ctx.logger.info("Paperclip Slack plugin started", {
      paperclipUrl: config.paperclipUrl,
      registeredEvents: Object.entries(config.events)
        .filter(([, cfg]) => cfg.enabled)
        .map(([key]) => key),
    });
  },

  async onValidateConfig(
    config: Record<string, unknown>,
  ): Promise<PluginConfigValidationResult> {
    const errors = await validateFullConfig({
      slackBotToken: (config.slackBotToken as string) ?? "",
      paperclipUrl:
        (config.paperclipUrl as string) || "http://localhost:3100",
      events:
        (config.events as PluginConfig["events"]) ??
        ({} as PluginConfig["events"]),
    });

    if (errors.length === 0) {
      return { ok: true };
    }
    return { ok: false, errors };
  },

  async onConfigChanged(
    newConfig: Record<string, unknown>,
  ): Promise<void> {
    setConfig({
      slackBotToken: (newConfig.slackBotToken as string) ?? "",
      paperclipUrl:
        (newConfig.paperclipUrl as string) || "http://localhost:3100",
      events: newConfig.events as PluginConfig["events"] | undefined,
    });
  },

  async onHealth(): Promise<PluginHealthDiagnostics> {
    const config = getConfig();

    if (!config.slackBotToken || !config.slackBotToken.startsWith("xoxb-")) {
      return {
        status: "degraded",
        message:
          "Slack Bot Token is not configured. Set a valid xoxb- token in the plugin settings.",
      };
    }

    try {
      const slack = new SlackClient(config.slackBotToken);
      await slack.authTest();
      return { status: "ok", message: "Slack connection verified." };
    } catch (e: any) {
      return {
        status: "error",
        message: `Cannot connect to Slack: ${e.message}`,
        details: { error: e.message },
      };
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
