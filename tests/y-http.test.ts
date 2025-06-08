import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider, messageAwareness } from '../src/y-http'
import { DummyServer } from './DummyServer.ts'
import { mockApi } from './mockApi.ts'
import { update, docWith } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'

beforeEach(() =>
    vi.useFakeTimers
)

afterEach(() =>
    vi.restoreAllMocks()
)

test('Instantiating the provider with a doc', () => {
    const doc = new Y.Doc()
    const provider = new HttpProvider(doc, mockApi())
    expect(provider.doc).toBe(doc)
    expect(provider.syncUpdate).toBeFalsy
    expect(provider.version).toBe(0)
})

test('exposes sync updates', () => {
    const provider = new HttpProvider(new Y.Doc(), mockApi())
    update(provider.doc)
    expect(docWith([provider.syncUpdate])).toEqual(provider.doc)
})

test('exposes awareness message', () => {
    const provider = new HttpProvider(new Y.Doc(), mockApi())
    provider.awareness.setLocalStateField('user', { name: 'me' })
    expect(typeof provider.awarenessUpdate).toBe('string')
    const message = fromBase64(provider.awarenessUpdate as string)
    expect(message[0]).toBe(messageAwareness)
})

test('tracks version from sync', async () => {
    const server = new DummyServer()
    const api = mockApi(server)
    const provider = new HttpProvider(new Y.Doc(), api)
    update(provider.doc)
    await provider.connect()
    expect(provider.version).toBeGreaterThan(0)
    expect(provider.version).toBe(server.version)
})

test('applies updates received from sync', async () => {
    const server = new DummyServer([
        "AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA==",
        "AAISAQHYidydCwOE2IncnQsCAWkA",
    ])
    const api = mockApi(server)
    const provider = new HttpProvider(new Y.Doc(), api)
    update(provider.doc)
    await provider.connect()
    expect(provider.doc.getXmlFragment('default'))
        .toMatchInlineSnapshot(`"<paragraph>Hi</paragraph>"`)
    expect(api.sync).toHaveBeenCalledOnce()
})

test('syncs docs via server on connection', async () => {
    const server = new DummyServer()
    const client1 = mockApi(server)
    const client2 = mockApi(server)
    const provider1 = new HttpProvider(new Y.Doc(), client1)
    const provider2 = new HttpProvider(new Y.Doc(), client2)
    update(provider1.doc)
    await provider1.connect()
    await provider2.connect()
    expect(provider2.doc).toEqual(provider1.doc)
})