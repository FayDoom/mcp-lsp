import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const configPath = resolve(process.env.USERPROFILE || process.env.HOME, ".claude.json")

const SERVER_NAME = "mcp-lsp"
const SERVER_CONFIG = {
	type: "stdio",
	command: "node",
	args: [resolve(__dirname, "index.js").replace(/\\/g, "/")],
	env: {}
}

let config
try {
	config = JSON.parse(readFileSync(configPath, "utf-8"))
} catch (err) {
	if (err.code === "ENOENT") {
		config = {}
	} else {
		console.error(`Failed to read ${configPath}:`, err.message)
		process.exit(1)
	}
}

if (!config.mcpServers) config.mcpServers = {}

if (config.mcpServers[SERVER_NAME]) {
	console.log(`"${SERVER_NAME}" already registered in ${configPath}`)
	process.exit(0)
}

config.mcpServers[SERVER_NAME] = SERVER_CONFIG
writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")
console.log(`"${SERVER_NAME}" added to ${configPath}`)
