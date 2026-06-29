# AGENTS.md — Paperclip Slack Plugin

## Commands

```bash
pnpm install              # first time (requires Node >= 24, pnpm >= 10)
pnpm run build            # esbuild + tsc → dist/
pnpm run dev              # watch mode (esbuild only, no typecheck)
pnpm run test             # vitest (19 tests, ~500ms)
pnpm run build:types      # tsc typecheck only (strict failures here block CI)
```

Always `build:types` after changing signatures — esbuild won't catch type errors.

## Paperclip SDK quirks

- **Calendar versioning**: `@paperclipai/plugin-sdk` uses calver (`2026.618.0`). Peer dep is `*`, dev dep pins the exact version for type resolution. Check `pnpm view @paperclipai/plugin-sdk version` before bumping.
- **`PluginConfigValidationResult`**: uses `{ ok: boolean; errors?: string[]; warnings?: string[] }`. Errors are flat strings, NOT per-field objects. There is no `PluginConfigValidationError` type in the SDK.
- **All getters return `T | null`**: `ctx.issues.get()`, `ctx.agents.get()`, `ctx.projects.get()` return `T | null`. Every call site needs a null guard. The type system enforces this strictly.
- **`ctx.state.get()` returns `Promise<unknown>`**: Cast/convert after checking non-null before using as a specific type.
- **`runWorker(plugin, import.meta.url)`**: last line of `src/worker.ts`. Required for the worker to start when loaded as the main module by the Paperclip host. No-op in test environments, but the plugin silently fails without it.
- **`@paperclipai/plugin-sdk` is externalized in esbuild**: `--external:@paperclipai/plugin-sdk` — the Paperclip host provides it at runtime. Only `@slack/web-api` is bundled into `dist/worker.js`.

## Architecture notes

- **Config is module-scoped cache** (`src/config.ts`). Event handlers call `getConfig()` synchronously — no `ctx.config.get()` on every event. Config is populated in `setup()` and refreshed in `onConfigChanged()`.
- **No native `issue.status_changed` event**. `src/events/issue-status.ts` subscribes to `issue.updated`, stores previous status via `ctx.state.get/set` (scopeKind `"issue"`), and compares. First-seen issues are silently skipped (no baseline notification).
- **Event registration is centralized**: `src/events/index.ts` → `registerAllHandlers(ctx)`. Adding a new event means touching 4 files: a handler in `events/`, `types.ts` (`EventKey` + `EventsConfig`), `manifest.ts` (JSON schema), and `events/index.ts` (registration).
- **Two entrypoints must align**: `package.json` `paperclipPlugin.manifest`/`.worker` fields and `manifest.ts` `entrypoints` both point to `dist/`. Mismatches break plugin loading.
- **`.js` extension required on local imports**: `module: "nodenext"` enforces explicit extensions. Omitting `.js` on local imports fails at typecheck.

## Release notes

- **Conventional Commits** enforced by semantic-release: `fix:` → patch, `feat:` → minor, `BREAKING CHANGE:` / `feat!:` → major. Non-conventional messages won't trigger releases.
- CI merges to `main` trigger `semantic-release`: version bump → npm publish (needs `NPM_TOKEN` secret) → GitHub Release.
- The `.releaserc.json` git plugin only commits `package.json`; no other files are auto-committed.

## Testing

- `tests/slack-client.test.ts` mocks `@slack/web-api` at module scope using `vi.mock`. Mock factories reference module-scoped `vi.fn()` variables (hoisted by vitest). Don't nest mock setup inside `describe` blocks.
- `tests/formatter.test.ts` validates Block Kit structure. Expect exact block counts per event variant. The `actions` block with "View in Paperclip" button is always the last block.

## Finding event payloads

- Start in Paperclip server `server/src/services/activity-log.ts`. `publishPluginDomainEvent()` is where the `PluginEvent` is assembled; payload is `{ ...details, agentId, runId }`.
- Check `ACTIVITY_ACTION_TO_PLUGIN_EVENT` in that file for activity action aliases such as `issue_comment_created` → `issue.comment.created` and budget/approval remaps.
- For plugin-originated issue payloads, inspect `server/src/services/plugin-host-services.ts` and search for `logPluginActivity({` or the action string. Important issue shapes there:
  - `issue.created`: `title`, `identifier`, `originKind`, `originId`, `billingCode`, `blockedByIssueIds`
  - `issue.updated`: `identifier`, `patch`, `_previous.status`, `_previous.assigneeAgentId`, `_previous.assigneeUserId`
  - `issue.comment.created`: `identifier`, `commentId`, `bodySnippet`
  - `issue.relations.updated`: `identifier`, `mutation`, `blockedByIssueIds`, `previousBlockedByIssueIds`
- For non-plugin-originated events, search the Paperclip repo for `logActivity(` and the plugin event name or activity action. Add focused tests using the real emitted `details` object before changing parser fallbacks.
