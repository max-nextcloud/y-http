import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider, messageAwareness, MIN_INTERVAL_BETWEEN_SYNCS } from '../src/y-http'
import { mockApi } from './mockApi.ts'
import { update, docWith } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'
import { DummyServer } from './DummyServer.ts'

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.restoreAllMocks()
})

test('sends updates', async () => {
    const server = new DummyServer([
        "AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA==",
        "AAISAQHYidydCwOE2IncnQsCAWkA",
    ])
    const api = mockApi(server)
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    update(provider.doc)
    vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
    expect(api.sync)
        .toHaveBeenCalledWith('url', api._connection, [provider.syncUpdate, provider.awarenessUpdate])
    const updates = api.sync.mock.lastCall?.[2]
    expect(updates.length).toBe(2) // awareness and sync
    expect(docWith(updates)).toEqual(provider.doc)
    expect(provider.doc.getXmlFragment('default'))
        .toMatchInlineSnapshot(`"<paragraph>Hi</paragraph>"`)
    await vi.waitUntil(() => !provider.syncUpdate)
    expect(provider.syncUpdate).toBe('')
})

test('sends pending updates after connecting', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    update(provider.doc)
    expect(provider.syncUpdate).toBeTruthy
    expect(api.sync)
        .not.toHaveBeenCalled()
    await provider.connect()
    expect(api.sync)
        .toHaveBeenCalledWith('url', api._connection, [provider.syncUpdate, provider.awarenessUpdate])
})

test('send at most one request every maxFrequency ms', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    expect(api.sync).toHaveBeenCalledTimes(1)
    update(provider.doc)
    update(provider.doc)
    expect(api.sync).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
    expect(api.sync).toHaveBeenCalledTimes(2)
})

test('include an awareness message', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    provider.awareness.setLocalStateField('user', { name: 'me' })
    await provider.connect()
    expect(api.sync).toHaveBeenCalledTimes(1)
    const updates = api.sync.mock.lastCall?.[2]
    // awareness update only
    expect(updates.length).toBe(1)
    const message = fromBase64(updates[0])
    expect(message[0]).toBe(messageAwareness)
})

test.todo('do not resend received updates')
test.todo('resend updates send during failed request')