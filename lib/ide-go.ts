import { EventEmitter } from 'events'
import { GoDatatipAdapter } from './datatip-adapter'
import { GoLanguageClient } from './language-client'

module.exports = new GoLanguageClient(
    new EventEmitter(),
    new GoDatatipAdapter()
)
