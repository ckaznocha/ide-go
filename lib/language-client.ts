import { Disposable } from 'atom'
import { BusySignalService } from 'atom-ide'
import { AutoLanguageClient } from 'atom-languageclient'
import { LanguageServerProcess } from 'atom-languageclient/build/lib//server-manager.js'
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
import { InitializeParams } from 'atom-languageclient/build/lib/languageclient'
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
import {
    findOrInstallGoLangserver,
    promptToInstallGoPlusIfNeeded,
    promptToUpdateWithGoPlus,
    promptToUpgradeManually,
    shouldUpgrade
} from './go-env'

interface InitializationOptions {
    funcSnippetEnabled?: boolean
    gocodeCompletionEnabled?: boolean
    formatTool?: string
    goimportsLocalPrefix?: string
    maxParallelism?: number
    useBinaryPkgCache?: boolean
}

const GO_READY_EVENT = Symbol('ide-go-env-ready')
const BUSY_SIGNAL_READY_EVENT = Symbol('ide-go-busy-siganl-ready')

export class GoLanguageClient extends AutoLanguageClient {
    readonly config: AtomPluginSettings = pkg.packageSettings
    private goGet?: GoPlus.GoGet
    private goConfig?: GoPlus.GoConfig

    constructor(
        private readonly emitter: EventEmitter,
        datatip: DatatipAdapter
    ) {
        super()
        this.datatip = datatip
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

    getRootConfigurationKey(): string {
        return pkg.name
    }

    getInitializeParams(
        projectPath: string,
        process: LanguageServerProcess
    ): InitializeParams {
        const params = super.getInitializeParams(projectPath, process)
        params.initializationOptions = {
            funcSnippetEnabled: !!getPluginSettingValue('funcSnippetEnabled'),
            gocodeCompletionEnabled: !!getPluginSettingValue(
                'completionEnabled'
            ),
            formatTool: getPluginSettingValue('formatTool'),
            goimportsLocalPrefix: getPluginSettingValue('goimportsLocalPrefix'),
            useBinaryPkgCache: !!getPluginSettingValue('useBinaryPkgCache')
        } as InitializationOptions
        return params
    }

    mapConfigurationObject(_configuration: any): any {
        this.restartAllServers()
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
            if (shouldUpgrade(customPath)) {
                promptToUpgradeManually()
            }
            busy.dispose()
            return customPath
        }

        promptToInstallGoPlusIfNeeded(pkg.name, this.getServerName(), busy)

        busy.setTitle(`Waiting for Go env`)
        await this.goReady()
        if (!this.goConfig || !this.goGet) {
            throw new Error('Failed to load Go environment.')
        }

        let serverPath = await findOrInstallGoLangserver(
            pkg.name,
            this.getServerName(),
            this.goConfig,
            this.goGet,
            busy
        )

        if (!serverPath) {
            throw new Error('Failed to locate language server.')
        }
        if (shouldUpgrade(serverPath)) {
            await promptToUpdateWithGoPlus(
                pkg.name,
                this.getServerName(),
                this.goGet
            )
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
}
