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
    getProcessArgs,
} from './atom-config'
import {
    findOrInstallGoLangserver,
    promptToInstallGoPlusIfNeeded,
    promptToUpdateWithGoPlus,
    promptToUpgradeManually,
    shouldUpgrade,
} from './go-env'

interface InitializationOptions {
    formatTool?: string
    funcSnippetEnabled?: boolean
    gocodeCompletionEnabled?: boolean
    goimportsLocalPrefix?: string
    maxParallelism?: number
    useBinaryPkgCache?: boolean
}

const GO_READY_EVENT = Symbol('ide-go-env-ready')
const BUSY_SIGNAL_READY_EVENT = Symbol('ide-go-busy-signal-ready')

/** Language client for go-langserver. */
export class GoLanguageClient extends AutoLanguageClient {
    public readonly config: AtomPluginSettings = pkg.packageSettings
    private goConfig?: GoPlus.GoConfig
    private goGet?: GoPlus.GoGet

    public constructor(
        private readonly emitter: EventEmitter,
        datatip: DatatipAdapter
    ) {
        super()
        this.datatip = datatip
    }

    /** Loads a BusySignalService. */
    public consumeBusySignal(service: BusySignalService): Disposable {
        const disposable = super.consumeBusySignal(service)
        this.emitter.emit(BUSY_SIGNAL_READY_EVENT)
        return disposable
    }

    /** Loads a GoPlus.GoConfig. */
    public consumeGoConfig(goConfig: GoPlus.GoConfig): void {
        this.goConfig = goConfig
        if (this.goGet) {
            this.emitter.emit(GO_READY_EVENT)
        }
    }

    /** Loads a GoPlus.GoGet. */
    public consumeGoGet(goGet: GoPlus.GoGet): void {
        this.goGet = goGet
        if (this.goConfig) {
            this.emitter.emit(GO_READY_EVENT)
        }
    }

    /** Activated for these scopes. */
    public getGrammarScopes(): string[] {
        return pkg.enhancedScopes
    }

    /** Initialize Params to use for the lsp. */
    public getInitializeParams(
        projectPath: string,
        process: LanguageServerProcess
    ): InitializeParams {
        const params = super.getInitializeParams(projectPath, process)
        const initializationOptions: InitializationOptions = {
            formatTool: getPluginSettingValue('formatTool'),
            funcSnippetEnabled: !!getPluginSettingValue('funcSnippetEnabled'),
            gocodeCompletionEnabled: !!getPluginSettingValue(
                'completionEnabled'
            ),
            goimportsLocalPrefix: getPluginSettingValue('goimportsLocalPrefix'),
            useBinaryPkgCache: !!getPluginSettingValue('useBinaryPkgCache'),
        }

        params.initializationOptions = initializationOptions
        return params
    }

    /** The programming language name. */
    public getLanguageName(): string {
        return 'Go'
    }

    /** They key to use for configurations. */
    public getRootConfigurationKey(): string {
        return pkg.name
    }

    /** The name of the lsp. */
    public getServerName(): string {
        return 'go-langserver'
    }

    /**
     * Map the configuration object. Used to restart the server when the
     * configuration changes.
     */
    public mapConfigurationObject(): void {
        this.restartAllServers().catch((e: Error) => {
            throw e
        })
    }

    /** Starts the lsp process. */
    public async startServerProcess(): Promise<ChildProcess> {
        const childProcess = spawn(await this.serverPath(), getProcessArgs(), {
            cwd: join(__dirname, '..'),
            env: process.env,
        })
        childProcess.on('exit', this.onExit.bind(this))
        return childProcess
    }

    private async busySignalReady(): Promise<void> {
        return new Promise(
            (resolve: () => void): void => {
                if (this.busySignalService) {
                    resolve()
                    return
                }
                this.emitter.on(BUSY_SIGNAL_READY_EVENT, resolve)
            }
        )
    }

    private async goReady(): Promise<void> {
        return new Promise(
            (resolve: () => void): void => {
                if (this.goConfig && this.goGet) {
                    resolve()
                    return
                }
                this.emitter.on(GO_READY_EVENT, resolve)
            }
        )
    }

    private onExit(code: number, _signal: string): void {
        if (code) {
            atom.notifications.addError(
                `${this.getLanguageName()} language server stopped unexpectedly.`,
                {
                    description: `Exit code: ${code}\n${this.processStdErr}`,
                    dismissable: true,
                }
            )
        }
    }

    private async serverPath(): Promise<string> {
        await this.busySignalReady()
        if (!this.busySignalService) {
            throw new Error('Busy Signal Service not loaded.')
        }
        const busy = this.busySignalService.reportBusy(
            `Looking for ${this.getServerName()}`
        )
        const customPath = getPluginSettingValue('customServerPath')
        if (customPath !== this.config.customServerPath.default) {
            if (shouldUpgrade(customPath)) {
                promptToUpgradeManually()
            }
            busy.dispose()
            return customPath
        }

        promptToInstallGoPlusIfNeeded(
            pkg.name,
            this.getServerName(),
            busy
        ).catch((e: Error) => {
            throw e
        })

        busy.setTitle(`Waiting for Go env`)
        await this.goReady()
        if (!this.goConfig || !this.goGet) {
            throw new Error('Failed to load Go environment.')
        }

        const serverPath = await findOrInstallGoLangserver(
            pkg.name,
            this.getServerName(),
            this.goConfig,
            this.goGet,
            busy
        )

        if (serverPath === false) {
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
}
