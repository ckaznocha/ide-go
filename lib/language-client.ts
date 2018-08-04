import { Range } from 'atom'
import { AutoLanguageClient } from 'atom-languageclient'
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
import { install } from 'atom-package-deps'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import * as pkg from '../package.json'
import { GoPlus } from '../typings/go-plus'
import {
    getPluginSettingValue,
    AtomPluginSettings,
    getProcessArgs
} from './atom-config'
import { TextEditor } from './datatip-adapter'

interface FileCodeFormatProvider {
    grammarScopes: string[]
    priority: number
    formatEntireFile: (
        exitor: TextEditor,
        range: Range
    ) => Promise<FileCodeFormat>
}

interface FileCodeFormat {
    newCursor?: number
    formatted: string
}

const GO_READY_EVENT = Symbol('ide-go-env-ready')

export class GoLanguageClient extends AutoLanguageClient {
    private readonly config: AtomPluginSettings
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

    async startServerProcess(): Promise<ChildProcess> {
        await install(pkg.name)

        const childProcess = spawn(await this.serverPath(), getProcessArgs(), {
            cwd: join(__dirname, '..'),
            env: process.env
        })
        childProcess.on('exit', this.onExit.bind(this))
        return childProcess
    }

    consumeGoGet(goGet: GoPlus.GoGet) {
        this.goGet = goGet
        if (this.goConfig) {
            this.emitter.emit(GO_READY_EVENT)
        }
    }

    consumeGoConfig(goConfig: GoPlus.GoConfig) {
        this.goConfig = goConfig
        if (this.goGet) {
            this.emitter.emit(GO_READY_EVENT)
        }
    }

    private goReady(): Promise<void> {
        return new Promise(resolve => {
            if (this.goConfig && this.goGet) {
                return resolve()
            }
            this.emitter.on(GO_READY_EVENT, resolve)
        })
    }

    private async serverPath(): Promise<string> {
        let customPath = getPluginSettingValue('customServerPath')
        if (customPath !== this.config.customServerPath.default) {
            return customPath
        }
        await this.goReady()
        if (!this.goConfig || !this.goGet) {
            throw new Error('Failed to load Go environment.')
        }

        let serverPath = await this.goConfig.locator.findTool(
            this.getServerName()
        )
        if (!serverPath) {
            await this.goGet.get({
                name: pkg.name,
                packageName: this.getServerName(),
                packagePath: 'github.com/sourcegraph/go-langserver/',
                type: 'missing'
            })
            serverPath = await this.goConfig.locator.findTool(
                this.getServerName()
            )
        }

        if (!serverPath) {
            throw new Error('Failed to locate language server.')
        }

        return serverPath
    }

    private onExit(code: number, _signal: string) {
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

    provideFileCodeFormat(): FileCodeFormatProvider {
        return {
            grammarScopes: this.getGrammarScopes(),
            priority: 1,
            formatEntireFile: this.getFileCodeFormat.bind(this)
        }
    }

    private async getFileCodeFormat(
        editor: TextEditor,
        range: Range
    ): Promise<FileCodeFormat> {
        const format = await this.getCodeFormat(editor, range)
        return { formatted: format[1].newText }
    }
}
