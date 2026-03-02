import { z } from 'zod'
import { resolve } from 'path'

export class DefinitionTool {
	name = 'lsp_definition'
	description = 'Go to definition of a symbol at a specific position. Returns the file path and line number of the definition. Line and character are 1-based.'
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
			const result = await client.definition(rawUri, line - 1, character - 1)
			return { content: [{ type: 'text', text: this.renderer.render(result, 'definition') }] }
		} catch (e) {
			this.logger.error(`Definition failed for ${resolved}`, { error: e.message })
			return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
		}
	}
}
