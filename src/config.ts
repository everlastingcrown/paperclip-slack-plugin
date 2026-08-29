import type { PluginConfig } from "./types.js";

const defaultConfig: PluginConfig = {
  slackBotToken: "",
  paperclipUrl: "http://localhost:3100",
  events: {
    "issue.created": { enabled: true, channels: ["#general"] },
    "issue.comment.created": { enabled: true, channels: ["#general"] },
    "issue.statusChanged": { enabled: true, channels: ["#general"] },
    "issue.checked_out": { enabled: false, channels: ["#general"] },
    "issue.released": { enabled: false, channels: ["#general"] },
    "approval.created": { enabled: true, channels: ["#general"] },
    "approval.decided": { enabled: true, channels: ["#general"] },
    "agent.run.finished": { enabled: false, channels: ["#alerts"] },
    "agent.run.cancelled": { enabled: true, channels: ["#alerts"] },
    "agent.run.failed": { enabled: true, channels: ["#alerts"] },
    "budget.incident.opened": { enabled: true, channels: ["#alerts"] },
    "budget.incident.resolved": { enabled: true, channels: ["#alerts"] },
  },
};

let latestConfig: PluginConfig = { ...defaultConfig };

function resolveConfig(partial: Partial<PluginConfig>): PluginConfig {
  const config: PluginConfig = {
    ...defaultConfig,
    ...partial,
    paperclipUrl: partial.paperclipUrl || defaultConfig.paperclipUrl,
    events: {
      ...defaultConfig.events,
      ...(partial.events ?? {}),
    },
  };

  for (const key of Object.keys(defaultConfig.events) as Array<keyof PluginConfig["events"]>) {
    if (partial.events?.[key]) {
      config.events[key] = {
        ...defaultConfig.events[key],
        ...partial.events[key],
      };
    }
  }

  return config;
}

/**
 * Returns the configuration most recently delivered by `onConfigChanged`.
 *
 * Event callbacks must not call `ctx.config.get()`: that host RPC is only
 * authorized for the invocation which created it, and is unavailable after an
 * event delivery has completed. This plugin is single-tenant, so a
 * worker-global cache is the correct configuration source for event handlers.
 */
export function getConfig(): PluginConfig {
  return latestConfig;
}

export function getLatestConfig(): PluginConfig {
  return latestConfig;
}

export function setConfig(
  partial: Partial<PluginConfig>,
): PluginConfig {
  const config = resolveConfig(partial);
  latestConfig = config;
  return config;
}
