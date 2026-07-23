---
name: chatbot
description: "Use when the user wants to add a configurable AI chatbot/assistant to a web app - a help bubble in the corner, a support bot, or an in-game NPC dialog - with a custom persona, scope guardrails, and static knowledge, powered by Gipity's LLM service with no API keys."
---

<!-- GENERATED from platform/docs/skills/chatbot.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`; in Codex or any other agent, follow the `gipity` skill's setup steps directly).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read chatbot`.

# Chatbot kit

`chatbot` is a Gipity kit that drops a configurable AI assistant into any web app: a help bubble in the corner, a support bot, or an in-game NPC dialog. You give it a **persona**, optional **scope guardrails** (what it will and won't answer), and optional **static knowledge**; it streams answers from Gipity's LLM service. No API keys, no backend to write.

## Install

```bash
gipity add chatbot
```

The installer drops the kit into `src/packages/chatbot/`, wires the import map (`import { mount } from '@gipity/chatbot'`), and declares `llm: owner_pays` in your `gipity.yaml` so logged-out visitors can use the bot. Frontend-only: no migrations, no functions. Run `gipity deploy dev` to ship.

## Two ways to use it

**1) Bubble widget (default)** - a `<chatbot-widget>` custom element, floating launcher in the corner:

```html
<chatbot-widget id="bot"></chatbot-widget>
<script type="module">
  import { mount } from '@gipity/chatbot';
  import config from './js/chatbot.config.js';
  mount('#bot', config);
</script>
```

**2) Headless engine** - bring your own UI (an in-game NPC dialog box, a custom panel):

```js
import { createChatbot } from '@gipity/chatbot';
import config from './js/chatbot.config.js';

const bot = createChatbot(config);
bot.on('delta', (text) => myUi.append(text));   // streaming chunks
bot.on('complete', () => myUi.stopThinking());
await bot.send('how do I fly the ship?');
```

## Config

Install scaffolds `src/js/chatbot.config.js` with **every key present, commented, and pre-filled** - persona, scope guardrails (with a worked refusal example), a knowledge placeholder, ui, model. Edit it in place; it is the config reference, so don't go looking for the shape elsewhere. Only `persona.name` and `persona.instructions` are required.

One thing worth knowing before you edit it: `scope` is what keeps the bot on-topic ("if someone asks something off-topic it should politely decline"). Fill `allowed` / `refused` / `onRefusal`, and keep at least one `refusalExamples` pair - the worked example is what makes the guardrail hold *in character*. (A stricter pre-classification step is on the roadmap.)

## Knowledge - 20k token budget

Give the bot facts to answer from. Two source types today:

- `{ type: 'text', content: '...' }` - inline text, validated at config-load.
- `{ type: 'url', url: 'https://...' }` - fetched once when the engine starts.

If the combined sources exceed `maxTokens` (default 20,000; estimate is `chars / 4`), the kit **throws** rather than silently truncating - trim the sources or raise the budget. File-based knowledge and RAG embeddings are on the roadmap; for now inline the content as a `text` source.

## Theming

Colors come from CSS variables. `theme: 'match-app'` (the default) reads `--primary` from the host page, so the bot matches your app automatically (the templates' `gipity-theme.css` defines `--primary`). Override per-instance with `ui.primaryColor`. The widget uses Shadow DOM, so host CSS won't leak in.

## Headless engine events

When you drive the bot yourself with `createChatbot(config)`:

```js
bot.on('start',            () => {});            // a send is starting
bot.on('delta',            (text) => {});        // streaming text chunk
bot.on('message',          (msg)  => {});        // a full message landed in history
bot.on('complete',         (msg)  => {});        // assistant response finished
bot.on('usage',            (u)    => {});        // tokens / credits, when reported
bot.on('reset',            ()     => {});        // history cleared
bot.on('error',            (err)  => {});        // something threw
bot.on('knowledge_loaded', ({ tokens }) => {});  // a url source finished loading
```

## What's not in v1

Tool-calling (an explicit `tools` allowlist exists in the config but project-function calling lands in a later PR), voice (`app-tts` + `app-audio`), vision, image generation, and persisted per-user history (`storage`) are wired in later PRs - the config keys are present but inert today. Build against persona + scope + knowledge for now.

## Verifying

After wiring it up, `gipity deploy dev` and open the page - the launcher should appear in the corner; the greeting renders on first open and the starter chips show before the first message.

## Related skills
- `app-llm` - the LLM service the chatbot calls under the hood
- `web-app-basics` / `web-ui-patterns` - building and styling the host page
- `deploy` - the deploy pipeline
