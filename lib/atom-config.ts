import * as pkg from '../package.json'

/** An object of plugin settings. */
export interface AtomPluginSettings {
    [key: string]: AtomPluginSetting
}

interface AtomPluginSetting {
    default: string | boolean
    description: string
    enum?: Array<string | number>
    order: number
    type: string
}

/** Get the value of a setting for this plugin. */
export const getPluginSettingValue = (key: string): string =>
    // tslint:disable-next-line: no-unsafe-any
    atom.config.get(`${pkg.name}.${key}`)

/** Creates a string of arguments to pass to the process. */
export const getProcessArgs = (): string[] => {
    const args: string[] = []

    if (getPluginSettingValue('diagnosticsEnabled')) {
        args.push('-diagnostics')
    }

    if (getPluginSettingValue('pprofAddr')) {
        args.push(`-pprof=${getPluginSettingValue('pprofAddr')}`)
    }
    return args
}
