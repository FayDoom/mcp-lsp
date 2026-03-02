export const LANGUAGE_CONFIG = {
	typescript: {
		extensions: ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'],
		command: 'typescript-language-server',
		args: ['--stdio'],
		languageIds: {
			'.ts': 'typescript',
			'.tsx': 'typescriptreact',
			'.js': 'javascript',
			'.jsx': 'javascriptreact',
			'.mts': 'typescript',
			'.cts': 'typescript',
			'.mjs': 'javascript',
			'.cjs': 'javascript'
		}
	},
	python: {
		extensions: ['.py', '.pyi'],
		command: 'pyright-langserver',
		args: ['--stdio'],
		languageIds: {
			'.py': 'python',
			'.pyi': 'python'
		}
	}
}

export const DIAGNOSTICS_TIMEOUT = 10000
export const REQUEST_TIMEOUT = 15000
