import { BusyMessage } from 'atom-ide'
import { install } from 'atom-package-deps'
import { execSync, SpawnSyncReturns } from 'child_process'
import { GoPlus } from '../typings/go-plus'

const GO_PACKAGE_PATH = 'github.com/sourcegraph/go-langserver/'

/** Finds the path to the lsp or installs it. */
export const findOrInstallGoLangserver = async (
    pluginName: string,
    serverName: string,
    goConfig: GoPlus.GoConfig,
    goGet: GoPlus.GoGet,
    busy: BusyMessage
): Promise<GoPlus.FindResult> => {
    busy.setTitle(`Looking for ${serverName}`)

    let serverPath = await goConfig.locator.findTool(serverName)
    if (serverPath === false) {
        busy.setTitle(`installing ${serverName}`)
        await goGet.get({
            name: pluginName,
            packageName: serverName,
            packagePath: GO_PACKAGE_PATH,
            type: 'missing',
        })
        busy.setTitle(`Looking for ${serverName}`)
        serverPath = await goConfig.locator.findTool(serverName)
    }
    busy.dispose()
    return serverPath
}

/** Prompts the user to install the lsp if it isn't found. */
export const promptToInstallGoPlusIfNeeded = async (
    pluginName: string,
    serverName: string,
    busy: BusyMessage
): Promise<void> => {
    if (!atom.packages.isPackageLoaded('go-plus')) {
        busy.setTitle('Waiting to install go-plus')
        const notification = atom.notifications.addInfo(
            'ide-go: Install go-plus?',
            {
                buttons: [
                    {
                        onDidClick: (): void => {
                            notification.dismiss()
                            busy.setTitle('Installing go-plus')
                            install(pluginName)
                        },
                        text: 'Yes',
                    },
                    {
                        onDidClick: (): void => {
                            notification.dismiss()
                        },
                        text: "I'll set the path myself",
                    },
                ],
                description: `If yes, click 'yes' on the next prompt.\n
If not, you'll need to set a custom path your '${serverName}' binary and restart atom before 'ide-go' will work.`,
                detail: `go-plus is used to install the latest version of ${serverName}`,
                dismissable: true,
            }
        )
    }
}

/** Prompts the user to upgrade the lsp using go plus. */
export const promptToUpdateWithGoPlus = async (
    pluginName: string,
    serverName: string,
    goGet: GoPlus.GoGet
): Promise<void> => {
    await goGet.get({
        name: pluginName,
        packageName: serverName,
        packagePath: GO_PACKAGE_PATH,
        type: 'outdated',
    })
}

/** Prompts the user to upgrade the lsp manually. */
export const promptToUpgradeManually = (): void => {
    atom.notifications.addWarning('ide-go: go-langserver is outdated', {
        description: 'Some features may not work correctly',
        detail: 'Your version of go-langserver is outdated. Please update it.',
        dismissable: true,
    })
}

/** Detects if the lsp should be upgraded. */
export const shouldUpgrade = (serverPath: string): boolean => {
    let buf: Buffer
    try {
        buf = execSync(`${serverPath} -help`)
    } catch (e) {
        buf = (e as SpawnSyncReturns<Buffer>).stderr
    }
    return buf.indexOf('-format-tool') < 0
}
