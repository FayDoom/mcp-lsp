const KIND_LABELS = {
	'quickfix': '🔧 Quick Fix',
	'refactor': '🔄 Refactor',
	'refactor.extract': '📦 Extract',
	'refactor.inline': '📥 Inline',
	'refactor.rewrite': '✏️ Rewrite',
	'source': '📄 Source',
	'source.organizeImports': '📂 Organize Imports',
	'source.fixAll': '🔧 Fix All'
}

export class CodeActionsRenderer {
	render(actions) {
		if (!actions || !actions.length) return 'No code actions available.'

		const lines = [`**${actions.length} code action(s) available:**\n`]

		for (const action of actions) {
			const kindLabel = KIND_LABELS[action.kind] || action.kind || 'Action'
			const preferred = action.isPreferred ? ' ⭐' : ''
			lines.push(`- ${kindLabel}: ${action.title}${preferred}`)

			if (action.diagnostics?.length) {
				for (const d of action.diagnostics) {
					lines.push(`  → ${d.message}`)
				}
			}
		}

		return lines.join('\n')
	}
}
