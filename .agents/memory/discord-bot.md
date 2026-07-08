---
name: Discord Emoji ZIP Uploader Bot
description: Architecture decisions, gotchas, and non-obvious rules for the Discord bot at artifacts/discord-bot
---

## Location
`artifacts/discord-bot/` — pnpm workspace package `@workspace/discord-bot`

## Non-obvious rules

**TypeScript catalog**: the pnpm workspace catalog (`pnpm-workspace.yaml`) does NOT include `typescript`. Use a direct version pin (`"typescript": "~5.9.3"`) in package.json, not `catalog:`.

**Components V2 flag**: every `interaction.reply` / `editReply` that uses `ContainerBuilder` components MUST include `flags: MessageFlags.IsComponentsV2`. Missing the flag causes Discord to silently discard all components.

**awaitMessages narrowing**: `interaction.channel` types include `PartialGroupDMChannel` which lacks `awaitMessages`. Narrow with `'awaitMessages' in channel` then cast to `TextChannel` before calling.

**Settings reset**: never call `sessionStore.create()` just to read default values — it creates a real session that counts against the guild session cap. Use the exported `getDefaultSettings()` helper instead.

**Cancellation is terminal**: the upload engine checks `finalSession.status === 'cancelled'` after the queue drains. Do not overwrite a cancelled session with `completed`.

**Slot pre-check**: check `staticAvailable < neededStatic` AND `animatedAvailable < neededAnimated` separately before starting uploads. Using `< 1` was the original bug.

**RESTJSONErrorCodes.InvalidFormBody** does not exist in the discord.js v14 enum — use the numeric code `50035` directly.

## Startup requirements
1. Copy `.env.example` → `.env` and fill in `DISCORD_TOKEN` + `DISCORD_CLIENT_ID`
2. `pnpm --filter @workspace/discord-bot run deploy` (needs `DISCORD_GUILD_ID` for guild-scope)
3. Start the "Discord Bot" workflow (or `run dev`)

**Why:** The bot exits at startup if config is missing (Zod env schema validation in `src/config/schema.ts`).

**Token/ClientID mismatch**: a valid `DISCORD_TOKEN` from the *wrong* Discord application logs in successfully (Discord doesn't reject it) but causes confusing downstream failures (slash commands never appear, wrong bot identity). Zod schema validation cannot catch this since it only checks format, not cross-field consistency. Fix: after `client.login()`, compare `client.application.id` to configured `clientId` and fail fast with a clear error naming both IDs. Diagnostic trick: the first `.`-delimited segment of a bot token is the base64-encoded application/bot user snowflake ID — decode it to check which app a token belongs to before assuming the token itself is invalid.
