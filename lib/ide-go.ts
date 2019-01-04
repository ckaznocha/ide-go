import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
// tslint:disable-next-line: no-import-side-effect
import 'reflect-metadata'
import { container } from 'tsyringe'
import { GoDatatipAdapter } from './datatip-adapter'
import { GoLanguageClient } from './language-client'

const client: GoLanguageClient = container
    .register<DatatipAdapter>(DatatipAdapter, {
        useClass: GoDatatipAdapter,
    })
    .resolve(GoLanguageClient)

module.exports = client
