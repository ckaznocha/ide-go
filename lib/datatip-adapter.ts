import { Point, TextEditor } from 'atom';
import { Datatip } from 'atom-ide';
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter';
import { LanguageClientConnection } from 'atom-languageclient/build/lib/languageclient';
import * as Utils from 'atom-languageclient/build/lib/utils';

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
