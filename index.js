import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Logger } from './utils/Logger.js'
import { LspClientManager } from './core/LspClientManager.js'
import { DiagnosticsRenderer } from './renderers/DiagnosticsRenderer.js'
import { LocationRenderer } from './renderers/LocationRenderer.js'
import { HoverRenderer } from './renderers/HoverRenderer.js'
import { CodeActionsRenderer } from './renderers/CodeActionsRenderer.js'
import { DiagnosticsTool } from './tools/DiagnosticsTool.js'
import { HoverTool } from './tools/HoverTool.js'
import { DefinitionTool } from './tools/DefinitionTool.js'
import { ReferencesTool } from './tools/ReferencesTool.js'
import { CodeActionsTool } from './tools/CodeActionsTool.js'

const logger = new Logger()
const manager = new LspClientManager(logger)

const diagnosticsRenderer = new DiagnosticsRenderer()
const locationRenderer = new LocationRenderer()
const hoverRenderer = new HoverRenderer()
const codeActionsRenderer = new CodeActionsRenderer()

const tools = [
	new DiagnosticsTool(manager, diagnosticsRenderer, logger),
	new HoverTool(manager, hoverRenderer, logger),
	new DefinitionTool(manager, locationRenderer, logger),
	new ReferencesTool(manager, locationRenderer, logger),
	new CodeActionsTool(manager, codeActionsRenderer, logger)
]

const server = new McpServer(
	{ name: 'mcp-lsp', version: '1.0.0' },
	{ capabilities: { tools: {} } }
)

for (const tool of tools) {
	server.registerTool(tool.name, {
		description: tool.description,
		inputSchema: tool.inputSchema
	}, (params) => tool.execute(params))
}

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
	logger.info('MCP LSP server started')
}

async function cleanup() {
	await manager.shutdownAll()
	process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

main().catch(async (error) => {
	await logger.error('Server startup failed', { error: error.message })
	process.exit(1)
})
