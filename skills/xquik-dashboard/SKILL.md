---
name: xquik-dashboard
description: "Use when the user wants to build a Gipity-hosted dashboard, monitor, chatbot context source, or realtime research tool backed by Xquik's public X data API, OpenAPI spec, MCP server, or webhooks."
---

# Xquik Dashboard

Build a Gipity app that uses Xquik as an external X data source. Good fits include trend dashboards, campaign monitors, competitor watchlists, social proof review tools, and internal research consoles.

Public Xquik references:

- OpenAPI: `https://xquik.com/openapi.json`
- MCP manifest: `https://xquik.com/.well-known/mcp.json`
- Docs: `https://docs.xquik.com`

Xquik exposes a public REST API, OpenAPI spec, webhooks, and MCP server for X data workflows. Use the user's Xquik API key only through environment variables or Gipity secrets. Never hard-code it in client code.

## Fit Check

Use this skill when:

- The app needs X posts, account activity, mentions, search results, trends, or webhook updates.
- The user wants a deployable UI, dashboard, monitor, or agent-facing research tool.
- Xquik is one external data provider among app UI, storage, auth, or realtime features.

Do not use this skill for generic X posting workflows or anything that needs unsupported Xquik endpoints.

## Build Plan

1. Confirm the X data question.
   - Target: account, keyword, URL, campaign, competitor, or trend.
   - Cadence: one-time pull, scheduled refresh, or webhook-driven.
   - Output: dashboard table, chart, alert, chatbot knowledge, or report.

2. Create the app shell.
   - Use the relevant Gipity app skill for the UI.
   - Keep Xquik calls server-side.
   - Store the Xquik API key in a secret or environment variable.

3. Add an API boundary.
   - Create a server route or function that calls Xquik.
   - Return only the fields the UI needs.
   - Normalize timestamps, source URLs, author handles, text excerpts, and metrics.
   - Surface upstream errors as user-actionable messages.

4. Render the dashboard.
   - Show source links for every row.
   - Separate observed Xquik data from generated summaries.
   - Include empty, loading, stale, and error states.
   - Add filters for query, date range, account, and signal type when useful.

5. Add realtime or alerts only when needed.
   - Use Gipity realtime for live UI updates.
   - Use Xquik webhooks or scheduled refreshes for new data.
   - Persist enough history to compare changes over time.

## Verification

Before deployment:

- Confirm no API key appears in frontend code, logs, README text, or screenshots.
- Run one server-side Xquik call with a narrow query.
- Verify empty results and rate-limit responses render clearly.
- Check links in the dashboard point back to source rows or public X URLs.

## Output

Return:

1. Data contract between the Gipity app and Xquik.
2. Routes, secrets, and UI files changed.
3. Validation result for the Xquik call and dashboard states.
4. Follow-up monitor or webhook plan if the app needs recurring data.
