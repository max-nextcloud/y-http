import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { Encoder, toUint8Array, writeUint8 } from 'lib0/encoding.js'
import { beforeEach, expect, test, vi } from 'vitest'
import { toBase64 } from 'lib0/buffer.js'

beforeEach(() =>
    vi.resetAllMocks()
)

// TODO: Check we do not resend received updates

test('Setting values on a XmlFragment', () => {
    const ydoc = new Y.Doc()
    const frag = ydoc.getXmlFragment('prosemirror')
    expect(frag).toBeInstanceOf(Y.XmlFragment)
    expect(frag.length).toBe(0)
    const elem = new Y.XmlElement('paragraph')
    frag.insert(0, [elem])
    expect(frag.length).toBe(1)
    expect(frag.toArray()[0]).toBe(elem)
    expect(frag).toMatchInlineSnapshot(`"<paragraph></paragraph>"`)
})

test('sync between two docs', () => {
    const source = new Y.Doc()
    const dest = new Y.Doc()
    source.on('update', update => {
        Y.applyUpdate(dest, update)
    })
    update(source)
    expect(dest).toEqual(source)
    update(dest)
    expect(source).not.toEqual(dest)
})

test('two way sync', () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    doc1.on('update', update => {
        Y.applyUpdate(doc2, update)
    })
    doc2.on('update', update => {
        Y.applyUpdate(doc1, update)
    })
    update(doc1)
    update(doc2)
    expect(doc1).toEqual(doc2)
})

test('using send with y-protocols', () => {
    const doc1 = new Y.Doc()
    const send = vi.fn()
    doc1.on('update', update => {
        const enc = new Encoder()
        writeUint8(enc, 0)
        sync.writeUpdate(enc, update)
        const data = toUint8Array(enc)
        send(toBase64(data))
    })
    update(doc1)
    expect(send).toHaveBeenCalled()
    const data = send.mock.lastCall?.[0]
    expect(data.slice(0, 3)).toMatchInlineSnapshot(`"AAI"`)
})

let _updateCount = 0
function update(doc: Y.Doc) {
    doc.getMap().set(`update-${_updateCount++}`, 'world')
}
