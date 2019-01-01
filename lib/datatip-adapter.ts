import { Point, TextEditor } from 'atom'
import { Datatip } from 'atom-ide'
import DatatipAdapter from 'atom-languageclient/build/lib/adapters/datatip-adapter'
import { LanguageClientConnection } from 'atom-languageclient/build/lib/languageclient'
import { getWordAtPosition } from 'atom-languageclient/build/lib/utils'

/** Extends the default DatatipAdapter to work with the non-standard output. */
export class GoDatatipAdapter extends DatatipAdapter {
    /** Override getDatatip to correct the range. */
    public async getDatatip(
        connection: LanguageClientConnection,
        editor: TextEditor,
        point: Point
    ): Promise<Datatip | null> {
        const res = await super.getDatatip(connection, editor, point)
        if (res) {
            res.range = getWordAtPosition(editor, point)
        }
        return res
    }
}
