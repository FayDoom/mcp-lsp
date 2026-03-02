export class LocationRenderer {
	render(locations, label = 'definition') {
		if (!locations || (Array.isArray(locations) && !locations.length)) return `No ${label} found.`

		const items = Array.isArray(locations) ? locations : [locations]

		if (items.length === 1) {
			const loc = this.normalizeLocation(items[0])
			return `**${label}**: ${this.formatLocation(loc)}`
		}

		const lines = [`**${items.length} ${label}(s) found:**\n`]
		for (const item of items) {
			const loc = this.normalizeLocation(item)
			lines.push(`- ${this.formatLocation(loc)}`)
		}
		return lines.join('\n')
	}

	normalizeLocation(loc) {
		if (loc.targetUri) return { uri: loc.targetUri, range: loc.targetSelectionRange || loc.targetRange }
		return loc
	}

	formatLocation(loc) {
		const path = this.uriToPath(loc.uri)
		const line = loc.range.start.line + 1
		const col = loc.range.start.character + 1
		return `${path}:${line}:${col}`
	}

	uriToPath(uri) {
		try { return decodeURIComponent(new URL(uri).pathname).replace(/^\/([a-zA-Z]:)/, '$1') }
		catch { return uri }
	}
}
