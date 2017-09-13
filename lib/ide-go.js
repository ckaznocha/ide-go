const { spawn } = require('child_process')
const { AutoLanguageClient } = require('atom-languageclient')
const DatatipAdapter = require('../node_modules/atom-languageclient/build/lib/adapters/datatip-adapter')
const Utils = require('../node_modules/atom-languageclient/build/lib/utils')
const path = require('path')
const { shell } = require('electron')
const { EventEmitter } = require('events')

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
        this.events = new EventEmitter()
        this.config = {
            customServerPath: {
                description: `Custom path to ${this.getServerName()}`,
                type: 'string',
                default: this.getServerName()
            }
        }
    }

    getGrammarScopes() {
        return ['source.go']
    }
    getLanguageName() {
        return 'Go'
    }
    getServerName() {
        return 'go-langserver'
    }

    async startServerProcess() {
        const childProcess = spawn(await this.serverPath(), [], {
            cwd: path.join(__dirname, '..')
        })
        childProcess.on('error', err =>
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
                    description: err.message
                }
            )
        )
        return childProcess
    }

    consumeGoGet(goGet) {
        this.goGet = goGet
        if (this.goConfig) {
            this.events.emit('go-ready')
        }
    }

    consumeGoConfig(goConfig) {
        this.goConfig = goConfig
        if (this.goGet) {
            this.events.emit('go-ready')
        }
    }

    goReady() {
        return new Promise(resolve => {
            if (this.goConfig && this.goGet) {
                return resolve()
            }
            this.events.on('go-ready', resolve)
        })
    }

    async serverPath() {
        let customPath = atom.config.get('ide-go.customServerPath')
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
            name: 'ide-go',
            packageName: this.getServerName(),
            packagePath: 'github.com/sourcegraph/go-langserver/',
            type: 'missing'
        })
        return await this.goConfig.locator.findTool(this.getServerName())
    }
}

module.exports = new GoLanguageClient()