import { dirname } from 'path'
import { pathToFileURL } from 'url'
import { LANGUAGE_CONFIG } from './constants.js'
import { LspClient } from './LspClient.js'

export class LspClientManager {
	clients = new Map()
	logger = null

	constructor(logger) {
		this.logger = logger
	}

	detectLanguage(filePath) {
		const ext = '.' + filePath.split('.').pop().toLowerCase()
		for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
			if (config.extensions.includes(ext)) return { lang, config }
		}
		return null
	}

	getRootUri(filePath) {
		return pathToFileURL(dirname(filePath)).href
	}

	async getClient(filePath) {
		const detected = this.detectLanguage(filePath)
		if (!detected) throw new Error(`Unsupported file type: ${filePath}`)

		const { lang, config } = detected
		if (this.clients.has(lang)) {
			const client = this.clients.get(lang)
			await client.ensureReady()
			return client
		}

		const rootUri = this.getRootUri(filePath)
		const client = new LspClient(lang, config, rootUri, this.logger)
		this.clients.set(lang, client)
		await client.ensureReady()
		return client
	}

	async shutdownAll() {
		const promises = []
		for (const [lang, client] of this.clients) {
			this.logger.info(`Shutting down client [${lang}]`)
			promises.push(client.shutdown())
		}
		await Promise.allSettled(promises)
		this.clients.clear()
	}
}
