import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider, MIN_INTERVAL_BETWEEN_SYNCS } from '../src/y-http'
import { mockApi } from './mockApi.ts'
import { anyUpdates, update, docWith } from './helpers.ts'

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.restoreAllMocks()
})

test('sends updates', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    update(provider.doc)
    vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
    expect(api.sync)
        .toHaveBeenCalledWith('url', api._connection, anyUpdates)
    const updates = api.sync.mock.lastCall?.[2]
    expect(updates.length).toBe(1)
    expect(docWith(updates)).toEqual(provider.doc)
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
        .toHaveBeenCalledWith('url', api._connection, anyUpdates)
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

test.todo('do not resend received updates')
test.todo('resend updates send during failed request')