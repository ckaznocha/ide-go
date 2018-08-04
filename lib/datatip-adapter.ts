import { Point, ScopeDescriptor, TextBuffer, TextEditor as NativeTextEditor } from 'atom';
import { Datatip } from 'atom-ide';
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter';
import { LanguageClientConnection } from 'atom-languageclient/build/lib/languageclient';
import Utils from 'atom-languageclient/build/lib/utils';


export interface TextEditor extends NativeTextEditor {
    getURI(): string | null
    getBuffer(): TextBuffer
    getNonWordCharacters(scope: ScopeDescriptor): string
}

export class GoDatatipAddapter extends DatatipAdapter {
    async getDatatip(
        connection: LanguageClientConnection,
        editor: TextEditor,
        point: Point
    ): Promise<Datatip | null> {
        let res = await super.getDatatip(connection, editor, point)
        if (res) {
            res.range = Utils.getWordAtPosition(editor, point)
        }
        return res
    }
}
