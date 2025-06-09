import * as Y from 'yjs'
import { beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider } from '../src/y-http'
import { mockClient } from './mockClient.ts'
import { randomFileId } from './helpers.ts'

beforeEach(() => vi.resetAllMocks())

test('connect using the client', () => {
	const doc = new Y.Doc()
	const client = mockClient()
	const provider = new HttpProvider(doc, client)
	provider.connect()
	expect(client.open).toHaveBeenCalled()
	expect(client.open.mock.lastCall).toEqual([doc.clientID])
})

test('exposes connection', async () => {
	const fileId = randomFileId()
	const client = mockClient({ fileId })
	const provider = new HttpProvider(new Y.Doc(), client)
	const connection = await provider.connect()
	expect(provider.connection).toBe(connection)
	expect(connection).toEqual({ fileId })
})

test('emit error when failing to connect', async () => {
	const client = mockClient()
	const err = new Error('failed to open')
	client.open.mockRejectedValue(err)
	const provider = new HttpProvider(new Y.Doc(), client)
	const onErr = vi.fn()
	provider.on('connection-error', onErr)
	await expect(provider.connect()).rejects.toThrowError(err)
	expect(onErr).toHaveBeenCalled()
	expect(onErr.mock.lastCall).toEqual([err, provider])
})
