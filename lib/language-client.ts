import { Range } from 'atom'
import { AutoLanguageClient } from 'atom-languageclient'
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
import { install } from 'atom-package-deps'
import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import * as pkg from '../package.json'
import { GoPlus } from '../typings/go-plus'
import { atomConfig, AtomPluginConfig, getProcessArgs } from './atom-config'
import { TextEditor } from './datatip-adapter'

export class GoLanguageClient extends AutoLanguageClient {
    private readonly config: AtomPluginConfig
    private goGet?: GoPlus.GoGet
    private goConfig?: GoPlus.GoConfig

    constructor(
        private readonly emitter: EventEmitter,
        datatip: DatatipAdapter
    ) {
        super()
        this.datatip = datatip
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
        return pkg.enhancedScopes
    }
    getLanguageName(): string {
        return 'Go'
    }
    getServerName(): string {
        return 'go-langserver'
    }

    async startServerProcess() {
        await install(pkg.name)

        const childProcess = spawn((await this.serverPath()) as string, getProcessArgs(), {
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
            name: pkg.name,
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
