import { BusyMessage } from 'atom-ide'
import { install } from 'atom-package-deps'
import { GoPlus } from '../typings/go-plus'

export async function findOrInstallGoLangserver(
    name: string,
    serverName: string,
    goConfig: GoPlus.GoConfig,
    goGet: GoPlus.GoGet,
    busy: BusyMessage
): Promise<GoPlus.FindResult> {
    busy.setTitle(`Looking for ${serverName}`)

    let serverPath = await goConfig.locator.findTool(serverName)
    if (!serverPath) {
        busy.setTitle(`installing ${serverName}`)
        await goGet.get({
            name: name,
            packageName: serverName,
            packagePath: 'github.com/sourcegraph/go-langserver/',
            type: 'missing'
        })
        busy.setTitle(`Looking for ${serverName}`)
        serverPath = await goConfig.locator.findTool(serverName)
    }
    busy.dispose()
    return serverPath
}

export async function promptToInstallGoPlusIfNeeded(
    name: string,
    serverName: string,
    busy: BusyMessage
) {
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
                            await install(name)
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
                detail: `go-plus is used to install the latest version of ${serverName}`,
                description: `If yes, click 'yes' on the next prompt.\n
If not, you'll need to set a custom path your '${serverName}' binary and restart atom before 'ide-go' will work.`,
                dismissable: true
            }
        )
    }
}