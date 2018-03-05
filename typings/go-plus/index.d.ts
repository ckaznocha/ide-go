import {Disposable} from 'atom'

declare namespace GoPlus {
    export type ExecutorOptions = {
        timeout?: number,
        encoding?: string,
        env?: { [key: string]: string },
        cwd?: string,
        input?: string
    }

    export type ExecResult = {
        error?: {
            code: number,
            errno?: string,
            message?: string,
            path: string
        },
        exitcode: number,
        stdout: string | Buffer,
        stderr: string | Buffer
    }

    export type Runtime = {
        path: string,
        version: string,
        name?: string,
        semver?: string,

        GOROOT: string,
        GOEXE: string,
        GOTOOLDIR: string
    }

    export type FindResult = string | false

    export type GoConfig = {
        executer: {
            exec: (command: string, args: Array<string>, options: ExecutorOptions) => Promise<ExecResult>,
            execSync: (command: string, args: Array<string>, options: ExecutorOptions) => ExecResult,
            getOptions: (kind: 'file' | 'project', editor: any) => ExecutorOptions
        },
        locator: {
            runtimes: () => Promise<Array<Runtime>>,
            runtime: () => Promise<false | Runtime>,
            gopath: () => string,
            findTool: (name: string) => Promise<FindResult>
        },
        environment: any
    }

    export type InteractiveGetOptions = {
        name: string,
        packageName: string,
        packagePath: string,
        type: 'missing' | 'outdated'
    }

    export type GoGet = {
        get: (options: InteractiveGetOptions) => Promise<any>,
        register: (importPath: string, callback?: Function) => Disposable
    }
}
