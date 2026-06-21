import type { PluginConfig } from "./types.js";

const defaultConfig: PluginConfig = {
  slackBotToken: "",
  paperclipUrl: "http://localhost:3100",
  events: {
    "issue.created": { enabled: true, channels: ["#general"] },
    "issue.comment.created": { enabled: true, channels: ["#general"] },
    "issue.statusChanged": { enabled: true, channels: ["#general"] },
    "approval.created": { enabled: true, channels: ["#general"] },
    "approval.decided": { enabled: true, channels: ["#general"] },
    "agent.run.failed": { enabled: true, channels: ["#alerts"] },
  },
};

let currentConfig: PluginConfig = { ...defaultConfig };

export function getConfig(): PluginConfig {
  return currentConfig;
}

export function setConfig(partial: Partial<PluginConfig>): void {
  currentConfig = {
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
      currentConfig.events[key] = {
        ...defaultConfig.events[key],
        ...partial.events[key],
      };
    }
  }
}
