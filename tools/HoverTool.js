import { z } from 'zod'
import { resolve } from 'path'

export class HoverTool {
	name = 'lsp_hover'
	description = 'Get hover information (type info, documentation) for a symbol at a specific position. Line and character are 1-based.'
	manager = null
	renderer = null
	logger = null

	constructor(manager, renderer, logger) {
		this.manager = manager
		this.renderer = renderer
		this.logger = logger
	}

	get inputSchema() {
		return {
			path: z.string().describe('Absolute file path'),
			line: z.number().int().min(1).describe('Line number (1-based)'),
			character: z.number().int().min(1).describe('Character position (1-based)')
		}
	}

	async execute({ path, line, character }) {
		const resolved = resolve(path)
		try {
			const client = await this.manager.getClient(resolved)
			const { rawUri } = await client.openDocument(resolved)
			const result = await client.hover(rawUri, line - 1, character - 1)
			return { content: [{ type: 'text', text: this.renderer.render(result) }] }
		} catch (e) {
			this.logger.error(`Hover failed for ${resolved}`, { error: e.message })
			return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
		}
	}
}
