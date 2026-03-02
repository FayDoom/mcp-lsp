import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG_DIR = join(__dirname, '..', 'logs')

export class Logger {
	initialized = false

	async init() {
		if (this.initialized) return
		await mkdir(LOG_DIR, { recursive: true })
		this.initialized = true
	}

	async log(level, message, data) {
		await this.init()
		const timestamp = new Date().toISOString()
		const entry = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`
		const logFile = join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`)
		await writeFile(logFile, entry, { flag: 'a' }).catch(() => {})
	}

	info(message, data) { return this.log('INFO', message, data) }
	warn(message, data) { return this.log('WARN', message, data) }
	error(message, data) { return this.log('ERROR', message, data) }
	debug(message, data) { return this.log('DEBUG', message, data) }
}
