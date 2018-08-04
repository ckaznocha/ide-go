import * as pkg from '../package.json';

export interface AtomPluginConfig {
    [key: string]: {
        description: string
        type: string
        default: string | boolean
        order: number
    }
}

export function atomConfig(key: string): string {
    return atom.config.get(`${pkg.name}.${key}`)
}

export function getProcessArgs(): string[] {
    const args: string[] = []
    if (atomConfig('completionEnabled')) {
        args.push('-gocodecompletion')
    }

    if (atomConfig('pprofAddr')) {
        args.push(`-pprof=${atomConfig('pprofAddr')}`)
    }
    return args
}
