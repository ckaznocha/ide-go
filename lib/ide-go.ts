import { EventEmitter } from 'events';
import { GoDatatipAddapter } from './datatip-adapter';
import { GoLanguageClient } from './language-client';

module.exports = new GoLanguageClient(new EventEmitter(), new GoDatatipAddapter())
