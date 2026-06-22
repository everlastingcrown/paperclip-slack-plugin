import { WebClient } from "@slack/web-api";
import type { Block, KnownBlock } from "@slack/types";

export interface ChannelInfo {
  id: string;
  name: string;
}

type ChannelListType = "public_channel" | "private_channel";

export class SlackClient {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async authTest(): Promise<{ ok: boolean; user_id?: string; team_id?: string }> {
    const result = await this.client.auth.test();
    return {
      ok: result.ok,
      user_id: result.user_id,
      team_id: result.team_id,
    };
  }

  async postMessage(
    channel: string,
    text: string,
    blocks: (Block | KnownBlock)[],
  ): Promise<{ ts: string; channel: string }> {
    const result = await this.client.chat.postMessage({
      channel,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    });
    return { ts: result.ts ?? "", channel: result.channel ?? "" };
  }

  async listChannels(type: ChannelListType = "public_channel"): Promise<ChannelInfo[]> {
    const channels: ChannelInfo[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.conversations.list({
        types: type,
        exclude_archived: true,
        limit: 200,
        cursor,
      });
      if (result.channels) {
        for (const ch of result.channels) {
          if (ch.id && ch.name) {
            channels.push({ id: ch.id, name: ch.name });
          }
        }
      }
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  async resolveChannel(nameOrId: string): Promise<string | null> {
    if (/^[CG][A-Z0-9]+$/.test(nameOrId)) {
      return nameOrId;
    }

    const cleanName = nameOrId.replace(/^#/, "");
    const publicChannels = await this.listChannels("public_channel");
    const publicChannel = publicChannels.find(
      (ch) => ch.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (publicChannel) {
      return publicChannel.id;
    }

    const privateChannels = await this.listChannels("private_channel");
    const privateChannel = privateChannels.find(
      (ch) => ch.name.toLowerCase() === cleanName.toLowerCase(),
    );
    return privateChannel?.id ?? null;
  }
}
