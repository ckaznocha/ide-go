import * as pkg from '../package.json'

export interface AtomPluginSettings {
    [key: string]: AtomPluginSetting
}

interface AtomPluginSetting {
    description: string
    type: 'string' | 'boolean'
    default: string | boolean
    order: number
}

export function getPluginSettingValue(key: string): string {
    return atom.config.get(`${pkg.name}.${key}`)
}

export function getProcessArgs(): string[] {
    const args: string[] = []
    if (getPluginSettingValue('completionEnabled')) {
        args.push('-gocodecompletion')
    }

    if (getPluginSettingValue('diagnosticsEnabled')) {
        args.push('-diagnostics')
    }

    if (getPluginSettingValue('pprofAddr')) {
        args.push(`-pprof=${getPluginSettingValue('pprofAddr')}`)
    }
    return args
}
