import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import { StreamMessageReader, StreamMessageWriter, createMessageConnection, RequestType } from 'vscode-jsonrpc/node.js'
import { DIAGNOSTICS_TIMEOUT, REQUEST_TIMEOUT } from './constants.js'

const InitializeRequest = new RequestType('initialize')
const ShutdownRequest = new RequestType('shutdown')
const HoverRequest = new RequestType('textDocument/hover')
const DefinitionRequest = new RequestType('textDocument/definition')
const ReferencesRequest = new RequestType('textDocument/references')
const CodeActionRequest = new RequestType('textDocument/codeAction')

export class LspClient {
	language = null
	config = null
	logger = null
	rootUri = null
	connection = null
	process = null
	ready = false
	initializing = null
	openDocuments = new Map()
	diagnosticsMap = new Map()
	diagnosticsWaiters = new Map()
	diagnosticsDebounce = new Map()
	documentVersions = new Map()

	constructor(language, config, rootUri, logger) {
		this.language = language
		this.config = config
		this.rootUri = rootUri
		this.logger = logger
	}

	normalizeUri(uri) {
		return decodeURIComponent(uri).replace(/^file:\/\/\/[A-Za-z]:/, m => m.toLowerCase())
	}

	async ensureReady() {
		if (this.ready) return
		if (this.initializing) return this.initializing
		this.initializing = this._initialize().catch(e => {
			this.initializing = null
			this.ready = false
			throw e
		})
		await this.initializing
	}

	async _initialize() {
		this.logger.info(`Starting LSP: ${this.config.command}`, { language: this.language, rootUri: this.rootUri })

		this.process = spawn(this.config.command, this.config.args, {
			shell: true,
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: new URL(this.rootUri).pathname.replace(/^\/([a-zA-Z]:)/, '$1')
		})

		this.process.stderr.on('data', chunk => {
			this.logger.debug(`LSP stderr [${this.language}]: ${chunk.toString().trim()}`)
		})

		this.process.on('exit', (code, signal) => {
			this.logger.info(`LSP exited [${this.language}]`, { code, signal })
			this.ready = false
			this.initializing = null
			this.connection = null
			this.openDocuments.clear()
			this.diagnosticsMap.clear()
			this.diagnosticsDebounce.clear()
			this.documentVersions.clear()
		})

		const reader = new StreamMessageReader(this.process.stdout)
		const writer = new StreamMessageWriter(this.process.stdin)
		this.connection = createMessageConnection(reader, writer)

		this.connection.onRequest('workspace/configuration', params => {
			return params.items.map(() => ({}))
		})

		this.connection.onRequest('client/registerCapability', () => null)

		this.connection.onRequest('window/workDoneProgress/create', () => null)

		this.connection.onNotification('textDocument/publishDiagnostics', params => {
			const normalizedUri = this.normalizeUri(params.uri)
			this.logger.debug(`publishDiagnostics [${this.language}] uri=${normalizedUri} count=${params.diagnostics.length}`)
			this.diagnosticsMap.set(normalizedUri, params.diagnostics)

			const waiters = this.diagnosticsWaiters.get(normalizedUri)
			if (waiters) {
				clearTimeout(this.diagnosticsDebounce.get(normalizedUri))
				this.diagnosticsDebounce.set(normalizedUri, setTimeout(() => {
					this.diagnosticsDebounce.delete(normalizedUri)
					const latest = this.diagnosticsMap.get(normalizedUri)
					const currentWaiters = this.diagnosticsWaiters.get(normalizedUri)
					if (currentWaiters) {
						for (const resolve of currentWaiters) resolve(latest)
						this.diagnosticsWaiters.delete(normalizedUri)
					}
				}, 1000))
			}
		})

		this.connection.listen()

		await this.connection.sendRequest(InitializeRequest, {
			processId: process.pid,
			rootUri: this.rootUri,
			capabilities: {
				textDocument: {
					hover: { contentFormat: ['markdown', 'plaintext'] },
					completion: { completionItem: { snippetSupport: false } },
					publishDiagnostics: { relatedInformation: true },
					definition: { linkSupport: true },
					references: {},
					codeAction: {
						codeActionLiteralSupport: {
							codeActionKind: {
								valueSet: [
									'quickfix', 'refactor', 'refactor.extract',
									'refactor.inline', 'refactor.rewrite',
									'source', 'source.organizeImports', 'source.fixAll'
								]
							}
						}
					}
				},
				window: {
					workDoneProgress: true
				},
				workspace: {
					workspaceFolders: true,
					configuration: true,
					didChangeConfiguration: { dynamicRegistration: false }
				}
			},
			workspaceFolders: [{ uri: this.rootUri, name: 'root' }]
		})

		await this.connection.sendNotification('initialized', {})
		await this.connection.sendNotification('workspace/didChangeConfiguration', { settings: {} })
		this.ready = true
		this.logger.info(`LSP ready [${this.language}]`)
	}

	async openDocument(filePath) {
		await this.ensureReady()
		const rawUri = pathToFileURL(filePath).href
		const normalizedUri = this.normalizeUri(rawUri)
		this.diagnosticsMap.delete(normalizedUri)
		clearTimeout(this.diagnosticsDebounce.get(normalizedUri))
		this.diagnosticsDebounce.delete(normalizedUri)

		if (this.openDocuments.has(normalizedUri)) {
			const version = (this.documentVersions.get(normalizedUri) || 1) + 1
			this.documentVersions.set(normalizedUri, version)
			const text = await readFile(filePath, 'utf-8')
			await this.connection.sendNotification('textDocument/didChange', {
				textDocument: { uri: rawUri, version },
				contentChanges: [{ text }]
			})
			return { rawUri, normalizedUri }
		}

		const text = await readFile(filePath, 'utf-8')
		const ext = '.' + filePath.split('.').pop()
		const languageId = this.config.languageIds[ext] || this.language

		this.documentVersions.set(normalizedUri, 1)
		await this.connection.sendNotification('textDocument/didOpen', {
			textDocument: { uri: rawUri, languageId, version: 1, text }
		})
		this.openDocuments.set(normalizedUri, rawUri)
		return { rawUri, normalizedUri }
	}

	async getDiagnostics(normalizedUri, timeout = DIAGNOSTICS_TIMEOUT) {
		this.logger.debug(`getDiagnostics waiting uri=${normalizedUri} timeout=${timeout}`)
		return new Promise(resolve => {
			const timer = setTimeout(() => {
				this.logger.debug(`getDiagnostics TIMEOUT uri=${normalizedUri}`)
				const waiters = this.diagnosticsWaiters.get(normalizedUri)
				if (waiters) {
					const idx = waiters.indexOf(wrappedResolve)
					if (idx !== -1) waiters.splice(idx, 1)
					if (!waiters.length) this.diagnosticsWaiters.delete(normalizedUri)
				}
				resolve(this.diagnosticsMap.get(normalizedUri) || [])
			}, timeout)

			const wrappedResolve = (diags) => {
				clearTimeout(timer)
				resolve(diags)
			}

			if (!this.diagnosticsWaiters.has(normalizedUri)) this.diagnosticsWaiters.set(normalizedUri, [])
			this.diagnosticsWaiters.get(normalizedUri).push(wrappedResolve)
		})
	}

	async hover(rawUri, line, character) {
		await this.ensureReady()
		return this.withTimeout(
			this.connection.sendRequest(HoverRequest, {
				textDocument: { uri: rawUri },
				position: { line, character }
			})
		)
	}

	async definition(rawUri, line, character) {
		await this.ensureReady()
		return this.withTimeout(
			this.connection.sendRequest(DefinitionRequest, {
				textDocument: { uri: rawUri },
				position: { line, character }
			})
		)
	}

	async references(rawUri, line, character, includeDeclaration = true) {
		await this.ensureReady()
		return this.withTimeout(
			this.connection.sendRequest(ReferencesRequest, {
				textDocument: { uri: rawUri },
				position: { line, character },
				context: { includeDeclaration }
			})
		)
	}

	async codeActions(rawUri, range, diagnostics = []) {
		await this.ensureReady()
		return this.withTimeout(
			this.connection.sendRequest(CodeActionRequest, {
				textDocument: { uri: rawUri },
				range,
				context: { diagnostics }
			})
		)
	}

	withTimeout(promise, ms = REQUEST_TIMEOUT) {
		let timer
		const timeout = new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error('LSP request timeout')), ms)
		})
		return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
	}

	async shutdown() {
		if (!this.connection) return
		this.logger.info(`Shutting down LSP [${this.language}]`)
		try {
			await this.connection.sendRequest(ShutdownRequest, null)
			await this.connection.sendNotification('exit')
		} catch (e) {
			this.logger.warn(`Shutdown error [${this.language}]`, { error: e.message })
		}
		this.connection.dispose()
		if (this.process && !this.process.killed) this.process.kill()
		this.ready = false
		this.connection = null
	}
}
