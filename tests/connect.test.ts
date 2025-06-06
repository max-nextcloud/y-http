import * as Y from 'yjs'
import { beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider } from '../src/y-http'
import { mockApi } from './mockApi.ts'

beforeEach(() =>
    vi.resetAllMocks()
)

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
