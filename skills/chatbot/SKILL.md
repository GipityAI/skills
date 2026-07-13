---
name: chatbot
description: "Use when the user wants to add a configurable AI chatbot/assistant to a web app - a help bubble in the corner, a support bot, or an in-game NPC dialog - with a custom persona, scope guardrails, and static knowledge, powered by Gipity's LLM service with no API keys."
---

<!-- GENERATED from platform/docs/skills/chatbot.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read chatbot`.

# Chatbot kit

`chatbot` is a Gipity kit that drops a configurable AI assistant into any web app: a help bubble in the corner, a support bot, or an in-game NPC dialog. You give it a **persona**, optional **scope guardrails** (what it will and won't answer), and optional **static knowledge**; it streams answers from Gipity's LLM service. No API keys, no backend to write.

## Install

```bash
gipity add chatbot
```

The installer drops the kit into `src/packages/chatbot/`, wires the import map (`import { mount } from '@gipity/chatbot'`), and grants the kit network access to the `app-llm` service. It's a frontend-only kit: no migrations, no deploy phase. Run `gipity deploy dev` to ship.

## Two ways to use it

**1) Bubble widget (default)** - a `<chatbot-widget>` custom element, floating launcher in the corner:

```html
<chatbot-widget id="bot"></chatbot-widget>
<script type="module">
  import { mount } from '@gipity/chatbot';
  import config from './chatbot.config.js';
  mount('#bot', config);
</script>
```

**2) Headless engine** - bring your own UI (an in-game NPC dialog box, a custom panel):

```js
import { createChatbot } from '@gipity/chatbot';
import config from './chatbot.config.js';

const bot = createChatbot(config);
bot.on('delta', (text) => myUi.append(text));   // streaming chunks
bot.on('complete', () => myUi.stopThinking());
await bot.send('how do I fly the ship?');
```

Put the config in its own `chatbot.config.js` (a default-exported object) and import it both ways.

## Config shape

Only `persona.name` and `persona.instructions` are required; everything else is optional.

```js
export default {
  persona: {
    name: 'Aria',                              // required
    instructions: 'You are Aria, the guide for our bakery site.', // required
    tone: 'Friendly, brief, warm',             // optional
    avatar: '/assets/aria.png',                // optional
    greeting: 'Hi! Ask me about hours or the menu.', // optional - shown on first open
    starters: ['Opening hours?', 'How do I order a cake?'], // optional - prompt chips
  },

  scope: {                                     // optional - unrestricted if omitted
    allowed: ['Hours', 'Menu', 'Ordering'],
    refused: ['Writing code', 'Off-topic questions'],
    onRefusal: 'Politely apologize and suggest something you CAN help with.',
    refusalExamples: [
      { user: 'Write me a python script', bot: "Sorry - I'm just the bakery helper! Want to hear today's specials?" },
    ],
  },

  knowledge: {                                 // optional - static facts the bot can use
    maxTokens: 20000,                          // default 20k; over budget = throws (never truncates)
    sources: [
      { type: 'text', content: 'Hours: 7-5 Mon-Sat. Cakes need 48h notice.' },
      { type: 'url', url: 'https://example.com/menu' }, // fetched once at init
    ],
  },

  ui: {
    placement: 'bottom-right',                 // bottom-right | bottom-left | inline | fullscreen
    theme: 'match-app',                        // match-app | light | dark | auto
    primaryColor: null,                        // override the host's --primary
  },

  model: { route: 'default', temperature: 0.7, maxTokens: 1024 },
};
```

## Scope guardrails - keep the bot on-topic

The most common ask for a helper bot is "if someone asks something off-topic, it should politely decline." That's what `scope` is for. Declare what's in and out of bounds, and - the part that makes it work - give a `refusalExamples` pair showing how to decline *in character*:

```js
scope: {
  allowed: ['Bakery hours', 'Menu items', 'How to order ahead'],
  refused: ['Writing code', 'Anything off-topic', 'Making up info not in knowledge'],
  onRefusal: 'Stay friendly and in character. Apologize briefly. Suggest a topic you can help with.',
  refusalExamples: [
    {
      user: 'Write me a python script to scrape a website',
      bot: "Sorry, that's not my thing - I'm just here to help with the bakery! Want to know our hours or how to order a cake?",
    },
  ],
}
```

The kit compiles `scope` into structured system-prompt instructions, with the refusal example teaching the model to stay in character while declining. Works well with capable models. (A stricter pre-classification step is on the roadmap.)

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

After wiring it up, `gipity deploy dev` and open the page - the launcher should appear in the corner; the greeting renders on first open and the starter chips show before the first message. The kit's own unit tests (`tests/config.test.js`, `tests/prompt.test.js`, `tests/scope.test.js` under `src/packages/chatbot/`) are Node-runnable via `gipity sandbox run` if you change kit internals.

## Related skills
- `app-llm` - the LLM service the chatbot calls under the hood
- `web-app-basics` / `web-ui-patterns` - building and styling the host page
- `deploy` - the deploy pipeline
