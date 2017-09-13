const { spawn } = require('child_process')
const { AutoLanguageClient } = require('atom-languageclient')
const DatatipAdapter = require('../node_modules/atom-languageclient/build/lib/adapters/datatip-adapter')
const Utils = require('../node_modules/atom-languageclient/build/lib/utils')
const path = require('path')
const { shell } = require('electron')

class GoDatatipAddapter extends DatatipAdapter {
    async getDatatip(connection, editor, point) {
        let res = await super.getDatatip(connection, editor, point)
        if (res === null) {
            return null
        }
        res.range = Utils.getWordAtPosition(editor, point)
        return res
    }
}

class GoLanguageClient extends AutoLanguageClient {
    constructor() {
        super()
        this.datatip = new GoDatatipAddapter()
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

    startServerProcess() {
        const childProcess = spawn(this.getServerName(), [], {
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
    }

    consumeGoConfig(goConfig) {
        goConfig.locator
            .findTool(this.getServerName())
            .then(v => console.log(v))
        this.goConfig = goConfig
    }
}

module.exports = new GoLanguageClient()
