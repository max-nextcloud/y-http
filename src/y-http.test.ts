import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { Encoder, toUint8Array, writeUint8 } from 'lib0/encoding.js'
import { beforeEach, expect, test, vi } from 'vitest'
import { fromBase64, toBase64 } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'
import { HttpProvider } from './y-http'

function areDocsEqual(a: unknown, b: unknown): boolean | undefined {
    const isADoc = a instanceof Y.Doc
    const isBDoc = b instanceof Y.Doc
    if (isADoc && isBDoc) {
        return JSON.stringify(a.getMap())
            === JSON.stringify(b.getMap())
    }
}
expect.addEqualityTesters([areDocsEqual])

function mockApi() {
    const _connection = {}
    const open = vi.fn()
    open.mockResolvedValue(_connection)
    const send = vi.fn()
    return { open, send, _connection }
}

beforeEach(() =>
    vi.resetAllMocks()
)

const anyUpdates = [ expect.any(String) ]

test('Instantiating the provider with a doc', () => {
    const doc = new Y.Doc()
    const provider = new HttpProvider('url', doc, mockApi())
    expect(provider.doc).toBe(doc)
    expect(provider.syncUpdate).toBeFalsy
    expect(provider.version).toBe(0)
})

test('connect using the api', () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    provider.connect()
    expect(api.open).toHaveBeenCalled()
    expect(api.open.mock.lastCall).toEqual(['url'])
})

test('exposes connection', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    expect(provider.connection).toBe(api._connection)
})

test('emit error when failing to connect', async () => {
    const api = mockApi()
    const err = new Error
    api.open.mockRejectedValue(err)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    const onErr = vi.fn()
    provider.on('connection-error', onErr)
    await provider.connect()
    expect(onErr).toHaveBeenCalled()
    expect(onErr.mock.lastCall).toEqual([err , provider])
})

test('sends updates', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    update(provider.doc)
    expect(api.send)
        .toHaveBeenCalledWith('url', api._connection, anyUpdates)
    const updates = api.send.mock.lastCall?.[2]
    expect(updates.length).toBe(1)
    expect(docWith(updates)).toEqual(provider.doc)
})

test('exposes updates', () => {
    const provider = new HttpProvider('url', new Y.Doc(), mockApi())
    update(provider.doc)
    expect(docWith([provider.syncUpdate])).toEqual(provider.doc)
})

test('sends pending updates after connecting', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    update(provider.doc)
    expect(provider.syncUpdate).toBeTruthy
    expect(api.send)
        .not.toHaveBeenCalled()
    await provider.connect()
    expect(api.send)
        .toHaveBeenCalledWith('url', api._connection, anyUpdates)
})

test('applies updates received after from send', async () => {
    const data = "AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA=="
    const data2 = "AAISAQHYidydCwOE2IncnQsCAWkA"
    const api = mockApi()
    const spy = vi.spyOn(api, 'send')
        .mockImplementation((_url, _con, updates) => ({
           data: [data, data2, ...updates],
           version: 123,
        }))
    const provider = new HttpProvider('url', new Y.Doc(), api)
    update(provider.doc)
    await provider.connect()
    expect(api.send)
        .toHaveBeenCalledWith('url', api._connection, anyUpdates)
    expect(provider.version).toBe(123)
    expect(provider.doc.getXmlFragment('default'))
        .toMatchInlineSnapshot(`"<paragraph>Hi</paragraph>"`)
    expect(spy).toHaveBeenCalledOnce()
})

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

function docWith(updates: string[]): Y.Doc {
    const dest = new Y.Doc()
    updates.forEach(u => receive(dest, u))
    return dest
}

function receive(dest: Y.Doc, data: string) {
    const dec = new Decoder(fromBase64(data))
    expect(readUint8(dec)).toBe(0)
    expect(readUint8(dec)).toBe(2)
    sync.readUpdate(dec, dest, 'test')
}