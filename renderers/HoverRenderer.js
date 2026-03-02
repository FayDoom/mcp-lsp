export class HoverRenderer {
	render(hover) {
		if (!hover) return 'No hover information available.'

		const contents = hover.contents
		if (typeof contents === 'string') return contents
		if (contents.value) return this.formatMarked(contents)
		if (Array.isArray(contents)) return contents.map(c => this.formatMarked(c)).join('\n\n')

		return String(contents)
	}

	formatMarked(content) {
		if (typeof content === 'string') return content
		if (content.language) return `\`\`\`${content.language}\n${content.value}\n\`\`\``
		if (content.kind === 'markdown') return content.value
		return content.value || String(content)
	}
}
