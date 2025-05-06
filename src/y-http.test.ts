import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { Encoder, toUint8Array, writeUint8 } from 'lib0/encoding.js'
import { beforeEach, expect, test, vi } from 'vitest'
import { fromBase64, toBase64 } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'
import { HttpProvider } from './y-http'

const api = {
    open: vi.fn(),
    send: vi.fn(),
}

beforeEach(() =>
    vi.resetAllMocks()
)

const anyUpdates = [ expect.any(Uint8Array) ]

test('Instantiating the provider with a doc', () => {
    const doc = new Y.Doc()
    const provider = new HttpProvider('url', doc, api)
    expect(provider.doc).toBe(doc)
    expect(provider.syncUpdate).toBeFalsy
})

test('connect using the api', () => {
    const provider = new HttpProvider('url', new Y.Doc(), api)
    provider.connect()
    expect(api.open).toHaveBeenCalled()
    expect(api.open.mock.lastCall).toEqual(['url'])
})

test('exposes connection', async () => {
    const connection = {}
    api.open.mockResolvedValue(connection)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    expect(provider.connection).toBe(connection)
})

test('emit error when failing to connect', async () => {
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
    const connection = {}
    api.open.mockResolvedValue(connection)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    const map = provider.doc.getMap()
    await provider.connect()
    map.set('hello', 'world')
    expect(api.send)
        .toHaveBeenCalledWith('url', connection, anyUpdates)
})

test('sends pending updates after connecting', async () => {
    const connection = {}
    api.open.mockResolvedValue(connection)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    const map = provider.doc.getMap()
    map.set('hello', 'world')
    expect(provider.syncUpdate).toBeTruthy
    await provider.connect()
    expect(api.send)
        .toHaveBeenCalledWith('url', connection, anyUpdates)
})

test('Setting values on a YMap', () => {
    const doc = new Y.Doc()
    const map = doc.getMap()
    expect(map.get('hello')).toBeUndefined
    map.set('hello', 'world')
    expect(map.get('hello')).toEqual('world')
})

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
    const sourceMap = source.getMap()
    sourceMap.set('hello', 'world')
    const destMap = dest.getMap()
    expect(destMap.get('hello')).toBe('world')
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
    const map1 = doc1.getMap()
    map1.set('hello', 'world')
    const map2 = doc2.getMap()
    map2.set('how', 'are you')
    expect(map2.get('hello')).toBe('world')
    expect(map1.get('how')).toBe('are you')
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
    const map1 = doc1.getMap()
    map1.set('hello', 'world')
    expect(send).toHaveBeenCalled()
    const data = send.mock.lastCall?.[0]
    expect(data.slice(0, 3)).toMatchInlineSnapshot(`"AAI"`)
})

test('receiving data', () => {
    const dest = new Y.Doc()
    const data = "AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA=="
    const data2 = "AAISAQHYidydCwOE2IncnQsCAWkA"
    apply(dest, data)
    apply(dest, data2)
    expect(dest.getXmlFragment('default')).toMatchSnapshot()
})

function apply(dest: Y.Doc, data: string) {
    const dec = new Decoder(fromBase64(data))
    expect(readUint8(dec)).toBe(0)
    expect(readUint8(dec)).toBe(2)
    sync.readUpdate(dec, dest, 'test')
}
