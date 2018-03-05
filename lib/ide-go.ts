import { spawn } from 'child_process'
import { AutoLanguageClient } from 'atom-languageclient'
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
import Utils from 'atom-languageclient/build/lib/utils'
import 'path'
import { EventEmitter } from 'events'
import { install } from 'atom-package-deps'
import {
    Point,
    TextBuffer,
    TextEditor as NativeTextEditor,
    ScopeDescriptor,
    Range
} from 'atom'
import { Datatip } from 'atom-ide'
import { join } from 'path'
import { LanguageClientConnection } from 'atom-languageclient/build/lib/languageclient'
import { GoPlus } from '../typings/go-plus'

const pkg = require('../package.json')

interface TextEditor extends NativeTextEditor {
    getURI(): string | null
    getBuffer(): TextBuffer
    getNonWordCharacters(scope: ScopeDescriptor): string
}

class GoDatatipAddapter extends DatatipAdapter {
    async getDatatip(
        connection: LanguageClientConnection,
        editor: TextEditor,
        point: Point
    ): Promise<Datatip | null> {
        let res = await super.getDatatip(connection, editor, point)
        if (res) {
            res.range = Utils.getWordAtPosition(editor, point)
        }
        return res
    }
}

class GoLanguageClient extends AutoLanguageClient {
    datatip: GoDatatipAddapter
    emitter: EventEmitter
    config: {
        [key: string]: {
            description: string
            type: string
            default: string | boolean
            order: number
        }
    }
    goGet: GoPlus.GoGet | null = null
    goConfig: GoPlus.GoConfig | null = null

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

    getGrammarScopes(): string[] {
        return pkg['enhancedScopes']
    }
    getLanguageName(): string {
        return 'Go'
    }
    getServerName(): string {
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

        const childProcess = spawn((await this.serverPath()) as string, args, {
            cwd: join(__dirname, '..'),
            env: process.env
        })
        childProcess.on('exit', (code: number, signal: string) =>
            this.onExit(code, signal)
        )
        return childProcess
    }

    consumeGoGet(goGet: GoPlus.GoGet) {
        this.goGet = goGet
        if (this.goConfig) {
            this.emitter.emit('go-ready')
        }
    }

    consumeGoConfig(goConfig: GoPlus.GoConfig) {
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
        let serverPath = await (this
            .goConfig as GoPlus.GoConfig).locator.findTool(this.getServerName())
        if (serverPath) {
            return serverPath
        }
        await (this.goGet as GoPlus.GoGet).get({
            name: pkg['name'],
            packageName: this.getServerName(),
            packagePath: 'github.com/sourcegraph/go-langserver/',
            type: 'missing'
        })
        return await (this.goConfig as GoPlus.GoConfig).locator.findTool(
            this.getServerName()
        )
    }

    onExit(code: number, _signal: string) {
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

    async getFileCodeFormat(
        editor: TextEditor,
        range: Range
    ): Promise<{ formatted: string }> {
        const format = await this.getCodeFormat(editor, range)
        return Promise.resolve({ formatted: format[1].newText })
    }
}

function atomConfig(key: string): string {
    return atom.config.get(`${pkg['name']}.${key}`)
}

module.exports = new GoLanguageClient()
