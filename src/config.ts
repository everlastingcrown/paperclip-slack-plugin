import type { PluginContext } from "@paperclipai/plugin-sdk";
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

const configsByContext = new Map<PluginContext, Map<string, PluginConfig>>();
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

export async function getConfig(
  ctx: PluginContext,
  companyId: string,
): Promise<PluginConfig> {
  const configsByCompany = configsByContext.get(ctx) ?? new Map();
  configsByContext.set(ctx, configsByCompany);

  const cached = configsByCompany.get(companyId);
  if (cached) return cached;

  const config = resolveConfig(
    (await ctx.config.get(companyId)) as Partial<PluginConfig>,
  );
  configsByCompany.set(companyId, config);
  latestConfig = config;
  return config;
}

export function initializeConfigCache(ctx: PluginContext): void {
  configsByContext.set(ctx, new Map());
}

export function getLatestConfig(): PluginConfig {
  return latestConfig;
}

export function setConfig(
  partial: Partial<PluginConfig>,
  companyId?: string | null,
): PluginConfig {
  const config = resolveConfig(partial);
  latestConfig = config;

  if (companyId) {
    for (const configsByCompany of configsByContext.values()) {
      configsByCompany.set(companyId, config);
    }
  } else {
    for (const configsByCompany of configsByContext.values()) {
      configsByCompany.clear();
    }
  }

  return config;
}
