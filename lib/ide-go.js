const { spawn } = require('child_process')
const { AutoLanguageClient } = require('atom-languageclient')
const DatatipAdapter = require('../node_modules/atom-languageclient/build/lib/adapters/datatip-adapter')
const CodeFormatAdapter = require('../node_modules/atom-languageclient/build/lib/adapters/code-format-adapter')
const Utils = require('../node_modules/atom-languageclient/build/lib/utils')
const path = require('path')
const { shell } = require('electron')
const { EventEmitter } = require('events')
const pkg = require('../package.json')
const { install } = require('atom-package-deps')

class GoDatatipAddapter extends DatatipAdapter {
    async getDatatip(connection, editor, point) {
        let res = await super.getDatatip(connection, editor, point)
        if (res) {
            res.range = Utils.getWordAtPosition(editor, point)
        }
        return res
    }
}

class GoLanguageClient extends AutoLanguageClient {
    constructor() {
        super()
        this.datatip = new GoDatatipAddapter()
        this.emitter = new EventEmitter()
        this.config = {
            customServerPath: {
                description: `Custom path to ${this.getServerName()}`,
                type: 'string',
                default: this.getServerName(),
                order: 1
            },
            completionEnabled: {
                description: 'Enable code completion (requires restart)',
                type: 'boolean',
                default: true,
                order: 2
            },
            pprofAddr: {
                description: 'pprof address (requires restart)',
                type: 'string',
                default: '',
                order: 3
            }
        }
    }

    getGrammarScopes() {
        return pkg['enhancedScopes']
    }
    getLanguageName() {
        return 'Go'
    }
    getServerName() {
        return 'go-langserver'
    }

    async startServerProcess() {
        await install(pkg['name'])

        const args = []
        if (atomConfig('completionEnabled')) {
            args.push('-gocodecompletion')
        }

        if (atomConfig('pprofAddr')) {
            args.push(`-pprof=${atomConfig('pprofAddr')}`)
        }

        const childProcess = spawn(await this.serverPath(), args, {
            cwd: path.join(__dirname, '..'),
            env: process.env
        })
        this.captureServerErrors(childProcess)
        childProcess.on('exit', (code, signal) => this.onExit(code, signal))
        return childProcess
    }

    consumeGoGet(goGet) {
        this.goGet = goGet
        if (this.goConfig) {
            this.emitter.emit('go-ready')
        }
    }

    consumeGoConfig(goConfig) {
        this.goConfig = goConfig
        if (this.goGet) {
            this.emitter.emit('go-ready')
        }
    }

    goReady() {
        return new Promise(resolve => {
            if (this.goConfig && this.goGet) {
                return resolve()
            }
            this.emitter.on('go-ready', resolve)
        })
    }

    async serverPath() {
        let customPath = atomConfig('customServerPath')
        if (customPath !== this.config.customServerPath.default) {
            return customPath
        }
        await this.goReady()
        let serverPath = await this.goConfig.locator.findTool(
            this.getServerName()
        )
        if (serverPath) {
            return serverPath
        }
        await this.goGet.get({
            name: pkg['name'],
            packageName: this.getServerName(),
            packagePath: 'github.com/sourcegraph/go-langserver/',
            type: 'missing'
        })
        return await this.goConfig.locator.findTool(this.getServerName())
    }

    handleSpawnFailure(err) {
        atom.notifications.addError(
            `Unable to start the ${this.getLanguageName()} language server.`,
            {
                dismissable: true,
                buttons: [
                    {
                        text: `Download ${this.getServerName()}`,
                        onDidClick: () =>
                            shell.openExternal(
                                'https://github.com/sourcegraph/go-langserver/blob/master/README.md'
                            )
                    }
                ],
                description: err.toString()
            }
        )
    }

    onExit(code, signal) {
        if (code) {
            atom.notifications.addError(
                `${this.getLanguageName()} language server stopped unexpectedly.`,
                {
                    dismissable: true,
                    description: `Exit code: ${code}\n${this.processStdErr}`
                }
            )
        }
    }

    provideFileCodeFormat() {
        return {
            grammarScopes: this.getGrammarScopes(),
            priority: 1,
            formatEntireFile: this.getFileCodeFormat.bind(this)
        }
    }

    async getFileCodeFormat(editor) {
        const server = await this._serverManager.getServer(editor)
        if (
            server == null ||
            !CodeFormatAdapter.canAdapt(server.capabilities)
        ) {
            return []
        }
        //HACK: get the first non empty 'newText'.
        return Promise.resolve({
            formatted: (await CodeFormatAdapter.formatDocument(
                server.connection,
                editor
            )).reduce((accu, elem) => {
                return accu || elem['newText'] || ''
            })
        })
    }
}

function atomConfig(key) {
    return atom.config.get(`${pkg['name']}.${key}`)
}

module.exports = new GoLanguageClient()
