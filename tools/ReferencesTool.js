import { z } from 'zod'
import { resolve } from 'path'

export class ReferencesTool {
	name = 'lsp_references'
	description = 'Find all references to a symbol at a specific position. Returns a list of locations where the symbol is used. Line and character are 1-based.'
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
			character: z.number().int().min(1).describe('Character position (1-based)'),
			includeDeclaration: z.boolean().optional().default(true)
				.describe('Include the declaration in results (default: true)')
		}
	}

	async execute({ path, line, character, includeDeclaration }) {
		const resolved = resolve(path)
		try {
			const client = await this.manager.getClient(resolved)
			const { rawUri } = await client.openDocument(resolved)
			const result = await client.references(rawUri, line - 1, character - 1, includeDeclaration)
			return { content: [{ type: 'text', text: this.renderer.render(result, 'reference') }] }
		} catch (e) {
			this.logger.error(`References failed for ${resolved}`, { error: e.message })
			return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
		}
	}
}
