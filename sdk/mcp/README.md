# @orbitspatial/osls-mcp

An MCP server for the **Orbit Speaker Layout System**. Connect it to your AI client and build
or edit `.osls` speaker layouts by describing them — it exposes tools to add/move/label speakers,
set channel orderings, validate, and export valid `.osls`, plus the schema, spec, BS.2051 table,
and the 14 blessed layouts as resources. No API key, login, or backend — your own AI does the
reasoning; this server keeps it correct (every export is validated).

## Use it

**Claude Desktop** — `claude_desktop_config.json`:
```json
{ "mcpServers": { "osls": { "command": "npx", "args": ["-y", "@orbitspatial/osls-mcp"] } } }
```

**Claude Code:**
```bash
claude mcp add osls -- npx -y @orbitspatial/osls-mcp
```

**Cursor** — add to `mcpServers` the same `{ "command": "npx", "args": ["-y", "@orbitspatial/osls-mcp"] }`.

Then ask: *"Build a 7.1.4 layout with extra-wide front speakers and export it as .osls."*

## Tools

`new_layout` · `load_preset` · `import_osls` · `add_speaker` · `move_speaker` · `update_speaker` ·
`remove_speaker` · `reorder_speakers` · `set_ordering` · `get_layout` · `validate_layout` ·
`label_position` · `position_for_label` · `list_presets` · `export_osls`

## Resources

`osls://schema` · `osls://spec` · `osls://bs2051` · `osls://presets/{key}` · `osls://working-layout`

## Live view (watch it build)

Add `--view` to watch layouts build in real time in a local 3D view:

    claude mcp add osls -- node /ABSOLUTE/PATH/sdk/mcp/dist/index.js --view

Open the URL printed to stderr (default `http://127.0.0.1:7777`). As the AI calls
`add_speaker` / `move_speaker` / `set_ordering`, speakers appear live. The view is
**read-only** and **local-only** — it binds `127.0.0.1`, so nothing leaves your machine.

Flags: `--port <n>` (default 7777, scans 7777–7787 if busy), `--open` (launch your browser).

Without `--view`, the server is byte-for-byte the plain stdio MCP server — no port is opened.

## Develop

`npm install && npm test` · `npm run build`. The schema, spec, and presets are embedded at build
(`npm run embed`); re-run after changing `../../schema`, `../../docs/SPEC.md`, or `../../layouts`.
