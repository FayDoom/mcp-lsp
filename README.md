# mcp-lsp

MCP server bridging Claude Code to Language Servers via `vscode-jsonrpc`. Built for Windows where Claude Code's built-in LSP plugins fail (`spawn()` without `shell: true` → ENOENT on `.cmd` shims).

## Tools

| Tool | Description | Input |
|---|---|---|
| `lsp_diagnostics` | Errors, warnings, hints | `path` (string or array) |
| `lsp_hover` | Type info and documentation | `path`, `line`, `character` |
| `lsp_definition` | Go to definition | `path`, `line`, `character` |
| `lsp_references` | Find all references | `path`, `line`, `character`, `includeDeclaration?` |
| `lsp_code_actions` | Quick fixes, refactorings | `path`, `startLine`, `endLine`, `diagnosticsOnly?` |

All positions are **1-based** (consistent with editor line numbers).

## Supported Languages

| Language | Server | Package |
|---|---|---|
| TypeScript / JavaScript | `typescript-language-server` | `npm i -g typescript-language-server typescript` |
| Python | `pyright-langserver` | `npm i -g pyright` |

## Setup

### Prerequisites

Language servers must be installed globally:

```bash
npm i -g typescript-language-server typescript
npm i -g pyright
```

### Install

```bash
git clone https://github.com/FayDoom/mcp-lsp.git
cd mcp-lsp
npm install
```

### Register with Claude Code

```bash
node add-mcp.js
```

Or manually:

```bash
claude mcp add --scope user mcp-lsp -- node /path/to/mcp-lsp/index.js
```

### Permissions

Add to `~/.claude/settings.json` under `permissions.allow`:

```json
"mcp__mcp-lsp__lsp_diagnostics",
"mcp__mcp-lsp__lsp_hover",
"mcp__mcp-lsp__lsp_definition",
"mcp__mcp-lsp__lsp_references",
"mcp__mcp-lsp__lsp_code_actions"
```

## Architecture

```
index.js                    ← MCP server, tool registration, stdio transport
core/
  constants.js              ← language configs, timeouts
  LspClient.js              ← vscode-jsonrpc wrapper, LSP lifecycle
  LspClientManager.js       ← one LspClient per language
tools/
  DiagnosticsTool.js        ← textDocument/publishDiagnostics (push model)
  HoverTool.js              ← textDocument/hover
  DefinitionTool.js         ← textDocument/definition
  ReferencesTool.js         ← textDocument/references
  CodeActionsTool.js        ← textDocument/codeAction
renderers/
  DiagnosticsRenderer.js    ← format errors/warnings
  LocationRenderer.js       ← format locations
  HoverRenderer.js          ← format hover content
  CodeActionsRenderer.js    ← format code actions
utils/
  Logger.js                 ← file-based logging (logs/)
```

## Design Notes

- **`shell: true`** on `spawn()` to resolve `.cmd` shims on Windows
- **Diagnostics are push-based** — LSP servers send them via notifications, not request-response. A 1s debounce settles rapid-fire updates before resolving.
- **URI normalization** — LSP servers return URIs like `file:///c%3A/...` while Node's `pathToFileURL` produces `file:///C:/...`. All internal lookups use normalized URIs; raw URIs are sent to the LSP.
- **One client per language** — a single `rootUri` per language server. Works well for single-project sessions.
- **Crash recovery** — if a language server dies, the next tool call automatically restarts it.
