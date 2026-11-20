---
name: chatbot
description: "Use when the user wants an AI chatbot or assistant in a web app - a help bubble, a support bot, a chat-with-your-data analyst, a ChatGPT-style page with saved conversations, or an in-game NPC - including one that looks things up or takes actions through the app's own backend, powered by Gipity's LLM service with no API keys."
---

<!-- GENERATED from platform/docs/skills/chatbot.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`; in Codex or any other agent, follow the `gipity` skill's setup steps directly).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy` (or `gipity deploy <env>` for an environment), `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read chatbot`.

# Chatbot kit

`chatbot` is a Gipity kit that puts an AI assistant into any web app: a help bubble in the corner, a panel in a page, a full-page chat with a conversation sidebar, or your own UI on the headless engine. It streams answers from the Gipity LLM service, and it can **call your app's functions as tools**, so the assistant can look things up in your database and take actions as the signed-in user. No API keys, no agent server to run.

**Building a whole chat app?** Start from the `ai-chat` app instead (`gipity add ai-chat` in an empty project): sign-in, saved conversations, a read-only SQL analyst tool over a demo dataset, a confirmed write tool, files, voice and a model picker, already wired. Swap its demo tables for the user's data.

## Install into an existing app

```bash
gipity add chatbot
```

The kit lands in `src/packages/chatbot/`, the import map gets `@gipity/chatbot`, `gipity.yaml` gets `llm: owner_pays` (so signed-out visitors can chat), and `src/js/chatbot.config.js` is scaffolded. Mount it:

```html
<chatbot-widget id="bot"></chatbot-widget>
<script type="module">
  import { mount } from '@gipity/chatbot';
  import config from './js/chatbot.config.js';
  mount('#bot', config);     // returns the element; element.bot is the engine
</script>
```

The full config, with every setting explained, is in `src/packages/chatbot/README.md`. Only `persona.name` and `persona.instructions` are required. An unknown setting throws, so a typo can't silently do nothing.

## Tools: let the assistant use your backend

A tool is one of your functions the model may call mid-answer. The kit runs it **as the signed-in visitor** through the client SDK, so the function's own `auth`, table grants and limits apply: the assistant can do exactly what that user could already do through the app, nothing more.

```js
tools: [
  {
    name: 'lookup_order',                       // what the model calls
    description: 'Find one of the user\'s orders by number. Returns { status, items, total }.',
    function: 'order-status',                   // functions/order-status.js
    parameters: { type: 'object', properties: { number: { type: 'string' } }, required: ['number'] },
  },
  {
    name: 'cancel_order',
    description: 'Cancel an order that has not shipped.',
    function: 'cancel-order',
    confirm: true,                              // the user must click Allow first
    parameters: { type: 'object', properties: { number: { type: 'string' } }, required: ['number'] },
  },
],
```

- The function receives the tool arguments as its body and returns JSON; return `{ error: '...' }` for an expected failure and the model reads it and recovers.
- **`description` is how the model decides when and how to call it.** Say what it does, when to use it, what it returns, and what it needs to call it well (for a SQL tool: the tables and rules).
- **`confirm: true` for anything that writes, sends or spends.** The widget shows an Allow / Don't allow card; a declined call is reported to the model.
- Personal data: declare the function `auth: user` and filter by `ctx.auth.userGuid`, as for any function. A tool that needs sign-in and is called signed out tells the model and shows a Sign in button.
- `run: async (args) => result` instead of `function` makes a browser-side tool (read the page, the cart, the game state).
- A model call per round, at most `model.maxToolSteps` (default 8) rounds per answer. Results over 30,000 characters are cut and the model is told.
- **Chat with data:** one `query_data` tool over a function that runs a single `SELECT` inside `db.tx` with `SET TRANSACTION READ ONLY`, granted only the tables it may read, with the tables and query rules in the tool's `description`. The `ai-chat` app's `functions/query-data.js` is the pattern to copy.

## Saved conversations

`storage.persist` picks where conversations live:

- `'local'`: this browser's localStorage. No backend; good for a public help bubble.
- `functionStore('chats')`: your app database, per signed-in user, through one function (import `functionStore` from `@gipity/chatbot`). Copy `functions/chats.js` and `migrations/001-chat.sql` from the `ai-chat` app; the protocol is in the kit README.

With storage on, an inline or full-page widget shows a sidebar (new, rename, delete), conversations get a short title from a small model, and regenerate / edit rewrite the saved tail.

## Features

`features` turns on photos (`vision`), text files like CSV, logs and JSON (`files`), voice (`voice`: mic via Gipity transcribe, read aloud via Gipity TTS) and a built-in `generate_image` tool (`imageGen`). Each uses an app service, so declare it in the `services` phase of `gipity.yaml` (`transcribe`, `tts`, `image`; usually `owner_pays`) or the call fails. `model.choices` adds a model picker; pick models that can call tools when you have tools (Gipity GPU models can't).

## Headless engine

`createChatbot(config)` is the same brain without the UI: `send(text, { attachments })`, `stop()`, `regenerate()`, `editLast(text)`, `newChat()`, `open(id)`, `conversations()`, `setModel(route)`, `history()`. Events: `start`, `delta`, `message`, `tool_start`, `tool_end`, `confirm` (call `approve()` or `deny()`), `usage`, `complete`, `error` (`err.visitorMessage` is safe to show), `auth_required`, `history`, `conversation`, `conversations`. `readAttachment(file)` turns a picked file into an attachment.

## Knowledge and guardrails

- Put each kind of information where the model uses it: who the bot is and how it works in `persona.instructions` (not a tool list); short facts most answers need in a `knowledge` source (`load: 'always'`, the default: sent every request in `<knowledge>` tags, 20,000 tokens total); long reference such as manuals or policies in `load: 'lookup'` sources with a `title` and `summary` (kept out of the prompt; a built-in `read_knowledge` tool lists them and reads one on demand, 10,000 tokens each); what a tool does and what it needs to call it well (a schema, valid values) in the tool's `description`; live or per-user data behind a tool. The kit adds the Markdown, attachment, confirm and today's-date notes itself. Over a budget throws, never truncates.
- Sources: `{ type: 'text', content }` or `{ type: 'url', url }`, each with optional `title`, `summary`, `load`.
- `scope`: `allowed` / `refused` / `onRefusal` plus at least one `refusalExamples` pair keeps the bot on-topic and in character.

## Long conversations

Each request carries the newest messages that fit about 75,000 tokens (at most 200 messages), starting at a user message so a tool result never loses its call. The whole conversation stays in `bot.history()` and in storage.

## Verifying

`gipity deploy dev`, then `gipity page inspect <url>` (add `--auth` for a page behind sign-in): clean console, the widget renders. Test each tool's function with `gipity test` (`ctx.fn.callAs(ctx.users.alice, ...)` for `auth: user`), including that one user can't reach another's data.

## Related skills
- `app-llm` - the LLM service under the kit, including tool calling for your own loop
- `app-database` - `db.tx` and table grants for data tools
- `app-auth` / `app-users` - sign-in, and private pages with `access:`
- `app-testing` - testing the functions your tools call
