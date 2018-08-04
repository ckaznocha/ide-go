import { EventEmitter } from 'events';
import { GoDatatipAddapter } from './datatip-adapter';
import { GoLanguageClient } from './language-client';

export default new GoLanguageClient(new EventEmitter(), new GoDatatipAddapter())
