import { Disposable, Range } from 'atom'
import { BusySignalService, BusyMessage } from 'atom-ide'
import { AutoLanguageClient } from 'atom-languageclient'
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
import { install } from 'atom-package-deps'
import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import * as pkg from '../package.json'
import { GoPlus } from '../typings/go-plus'
import {
    AtomPluginSettings,
    getPluginSettingValue,
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
const BUSY_SIGNAL_READY_EVENT = Symbol('ide-go-busy-siganl-ready')

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
            diagnosticsEnabled: {
                description:
                    'Enable diagnostics (extra memory burden) (requires restart)',
                type: 'boolean',
                default: false,
                order: 3
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

    consumeBusySignal(service: BusySignalService): Disposable {
        const disposable = super.consumeBusySignal(service)
        this.emitter.emit(BUSY_SIGNAL_READY_EVENT)
        return disposable
    }

    private busySignalReady(): Promise<void> {
        return new Promise(resolve => {
            if (this.busySignalService) {
                return resolve()
            }
            this.emitter.on(BUSY_SIGNAL_READY_EVENT, resolve)
        })
    }

    private async serverPath(): Promise<string> {
        await this.busySignalReady()
        const busy = this.busySignalService.reportBusy(
            `Looking for ${this.getServerName()}`
        )
        let customPath = getPluginSettingValue('customServerPath')
        if (customPath !== this.config.customServerPath.default) {
            busy.dispose()
            return customPath
        }

        this.promptToInstallGoPlusIfNeeded(busy)

        busy.setTitle(`Waiting for Go env`)
        await this.goReady()
        if (!this.goConfig || !this.goGet) {
            throw new Error('Failed to load Go environment.')
        }

        busy.setTitle(`Looking for ${this.getServerName()}`)
        let serverPath = await this.goConfig.locator.findTool(
            this.getServerName()
        )
        if (!serverPath) {
            busy.setTitle(`installing ${this.getServerName()}`)
            await this.goGet.get({
                name: pkg.name,
                packageName: this.getServerName(),
                packagePath: 'github.com/sourcegraph/go-langserver/',
                type: 'missing'
            })
            busy.setTitle(`Looking for ${this.getServerName()}`)
            serverPath = await this.goConfig.locator.findTool(
                this.getServerName()
            )
        }

        if (!serverPath) {
            throw new Error('Failed to locate language server.')
        }
        busy.dispose()

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

    private promptToInstallGoPlusIfNeeded(busy: BusyMessage) {
        if (!atom.packages.isPackageLoaded('go-plus')) {
            busy.setTitle('Waitin to install go-plus')
            let notification = atom.notifications.addInfo(
                'ide-go: Install go-plus?',
                {
                    buttons: [
                        {
                            onDidClick: async () => {
                                notification.dismiss()
                                busy.setTitle('Installing go-plus')
                                await install(pkg.name)
                            },
                            text: 'Yes'
                        },
                        {
                            onDidClick: () => {
                                notification.dismiss()
                            },
                            text: "I'll set the path myself"
                        }
                    ],
                    detail: `go-plus is used to install the latest version of ${this.getServerName()}`,
                    description: `If yes, click 'yes' on the next prompt.\n
If not, you'll need to set a custom path your '${this.getServerName()}' binary and restart atom before 'ide-go' will work.`,
                    dismissable: true
                }
            )
        }
    }
}
