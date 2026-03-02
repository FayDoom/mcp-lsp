import { z } from 'zod'
import { resolve } from 'path'

export class CodeActionsTool {
	name = 'lsp_code_actions'
	description = 'Get available code actions (quick fixes, refactorings) for a line range. Lines are 1-based.'
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
			startLine: z.number().int().min(1).describe('Start line (1-based)'),
			endLine: z.number().int().min(1).describe('End line (1-based)'),
			diagnosticsOnly: z.boolean().optional().default(false)
				.describe('Only return actions related to diagnostics (default: false)')
		}
	}

	async execute({ path, startLine, endLine, diagnosticsOnly }) {
		const resolved = resolve(path)
		try {
			const client = await this.manager.getClient(resolved)
			const { rawUri, normalizedUri } = await client.openDocument(resolved)

			const range = {
				start: { line: startLine - 1, character: 0 },
				end: { line: endLine - 1, character: Number.MAX_SAFE_INTEGER }
			}

			const diagnostics = diagnosticsOnly
				? (await client.getDiagnostics(normalizedUri)).filter(d =>
					d.range.start.line >= startLine - 1 && d.range.end.line <= endLine - 1)
				: []

			const result = await client.codeActions(rawUri, range, diagnostics)
			return { content: [{ type: 'text', text: this.renderer.render(result) }] }
		} catch (e) {
			this.logger.error(`Code actions failed for ${resolved}`, { error: e.message })
			return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
		}
	}
}
