import * as Y from 'yjs'
import { beforeEach, expect, test as baseTest, vi } from 'vitest'
import type { Mock } from 'vitest'
import { HttpProvider, YHttpClient } from '../src/y-http'
import { randomFileId } from './helpers.ts'
import { mockClient } from './mockClient.ts'

interface ServerlessFixture {
	fileId: number
	client: { sync: Mock<YHttpClient["sync"]>, open: Mock<YHttpClient["open"]> }
	provider: HttpProvider
}

const test = baseTest.extend<ServerlessFixture>({
	fileId: ({ task: _ }, use) => use(randomFileId()),
	client: ({ fileId }, use) => use(mockClient(fileId)),
	provider: ({ client }, use) => use(new HttpProvider(new Y.Doc(), client)),
})

beforeEach(() => vi.resetAllMocks())

test('connect using the client', ({ provider, client }) => {
	provider.connect()
	expect(client.open).toHaveBeenCalled()
	expect(client.open.mock.lastCall).toEqual([provider.doc.clientID])
})

test('exposes connection', async ({ provider, fileId }) => {
	const connection = await provider.connect()
	expect(provider.connection).toBe(connection)
	expect(connection).toEqual({ fileId })
})

test('emit error when failing to connect', async ({ client, provider }) => {
	const err = new Error('failed to open')
	client.open.mockRejectedValue(err)
	const onErr = vi.fn()
	provider.on('connection-error', onErr)
	await expect(provider.connect()).rejects.toThrowError(err)
	expect(onErr).toHaveBeenCalled()
	expect(onErr.mock.lastCall).toEqual([err, provider])
})
