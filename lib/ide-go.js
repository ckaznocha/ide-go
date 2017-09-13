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
        await this.goReady()
        let serverPath = await this.goConfig.locator.findTool(
            this.getServerName()
        )
        if (!serverPath) {
            await this.goGet.get({
                name: 'ide-go',
                packageName: this.getServerName(),
                packagePath: 'github.com/sourcegraph/go-langserver/',
                type: 'missing'
            })
            serverPath = await this.goConfig.locator.findTool(
                this.getServerName()
            )
        }
        const childProcess = spawn(serverPath, [], {
            cwd: path.join(__dirname, '..')
        })
        childProcess.on('error', err =>
            atom.notifications.addError(
                'Unable to start the Go language server.',
                {
                    dismissable: true,
                    buttons: [
                        {
                            text: 'Download go-langserver',
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
            this.events.on('go-ready', resolve)
        })
    }
}

module.exports = new GoLanguageClient()
