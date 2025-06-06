import * as Y from 'yjs'
import { beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider } from '../src/y-http'
import { mockApi } from './mockApi.ts'
import { anyUpdates, update, docWith } from './helpers.ts'

beforeEach(() =>
    vi.resetAllMocks()
)

test('sends updates', async () => {
    const api = mockApi()
    const provider = new HttpProvider('url', new Y.Doc(), api)
    await provider.connect()
    update(provider.doc)
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

test.todo('do not resend received updates')
test.todo('resend updates send during failed request')
test.todo('send at most one request every maxFrequency ms')
