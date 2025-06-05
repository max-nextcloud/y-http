import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { beforeEach, expect, test, vi } from 'vitest'
import { fromBase64, } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'
import { HttpProvider } from '../src/y-http'
import { DummyServer } from './DummyServer.ts'
import { mockApi } from './mockApi.ts'

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

test('tracks version from send', async () => {
    const server = new DummyServer()
    const api = mockApi(server)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    update(provider.doc)
    await provider.connect()
    expect(provider.version).toBeGreaterThan(0)
    expect(provider.version).toBe(server.version)
})

test('applies updates received after from send', async () => {
    const server = new DummyServer([
        "AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA==",
        "AAISAQHYidydCwOE2IncnQsCAWkA",
    ])
    const api = mockApi(server)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    update(provider.doc)
    await provider.connect()
    expect(provider.doc.getXmlFragment('default'))
        .toMatchInlineSnapshot(`"<paragraph>Hi</paragraph>"`)
    expect(api.send).toHaveBeenCalledOnce()
})

// TODO: Check we do not resend received updates

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