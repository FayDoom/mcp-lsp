const SEVERITY_MAP = {
	1: 'Error',
	2: 'Warning',
	3: 'Information',
	4: 'Hint'
}

const SEVERITY_ICON = {
	1: '❌',
	2: '⚠️',
	3: 'ℹ️',
	4: '💡'
}

export class DiagnosticsRenderer {
	render(uri, diagnostics) {
		if (!diagnostics.length) return `No diagnostics for ${this.uriToPath(uri)}`

		const lines = [`**${this.uriToPath(uri)}** — ${diagnostics.length} diagnostic(s)\n`]

		for (const d of diagnostics) {
			const severity = SEVERITY_MAP[d.severity] || 'Unknown'
			const icon = SEVERITY_ICON[d.severity] || '?'
			const line = d.range.start.line + 1
			const col = d.range.start.character + 1
			const source = d.source ? ` [${d.source}]` : ''
			const code = d.code !== undefined ? ` (${typeof d.code === 'object' ? d.code.value : d.code})` : ''
			lines.push(`${icon} **${severity}** L${line}:${col}${source}${code}`)
			lines.push(`  ${d.message}`)
		}

		return lines.join('\n')
	}

	renderMultiple(diagnosticsByUri) {
		const entries = [...diagnosticsByUri.entries()]
		if (entries.every(([, diags]) => !diags.length)) return 'No diagnostics found.'

		return entries
			.filter(([, diags]) => diags.length > 0)
			.map(([uri, diags]) => this.render(uri, diags))
			.join('\n\n---\n\n')
	}

	uriToPath(uri) {
		try { return decodeURIComponent(new URL(uri).pathname).replace(/^\/([a-zA-Z]:)/, '$1') }
		catch { return uri }
	}
}
