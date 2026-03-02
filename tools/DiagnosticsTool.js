import { z } from 'zod'
import { resolve } from 'path'

export class DiagnosticsTool {
	name = 'lsp_diagnostics'
	description = 'Get diagnostics (errors, warnings) for one or more files from the Language Server. Returns typed errors, warnings, and hints with line numbers.'
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
			path: z.union([z.string(), z.array(z.string())])
				.describe('Absolute file path or array of paths to get diagnostics for')
		}
	}

	async execute({ path }) {
		const paths = Array.isArray(path) ? path : [path]
		const results = new Map()

		for (const filePath of paths) {
			const resolved = resolve(filePath)
			try {
				const client = await this.manager.getClient(resolved)
				const { normalizedUri } = await client.openDocument(resolved)
				const diagnostics = await client.getDiagnostics(normalizedUri)
				results.set(normalizedUri, diagnostics)
			} catch (e) {
				this.logger.error(`Diagnostics failed for ${resolved}`, { error: e.message })
				return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
			}
		}

		return { content: [{ type: 'text', text: this.renderer.renderMultiple(results) }] }
	}
}
