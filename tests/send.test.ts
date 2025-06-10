import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test as baseTest, vi } from 'vitest'
import type { Mock } from 'vitest'
import {
	HttpProvider,
	MAX_INTERVAL_BETWEEN_SYNCS,
	messageAwareness,
	MIN_INTERVAL_BETWEEN_SYNCS,
	YHttpClient,
} from '../src/y-http'
import { mockClient } from './mockClient.ts'
import { updateDoc, docWith, updateAwareness, randomFileId } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'
import { DummyServer } from './DummyServer.ts'

interface ProviderFixture {
	fileId: number
	server: DummyServer
	client: { sync: Mock<YHttpClient["sync"]>, open: Mock<YHttpClient["open"]> }
	provider: HttpProvider
}

const test = baseTest.extend<ProviderFixture>({
	fileId: ({ task: _ }, use) => use(randomFileId()),
	server: ({ task: _ }, use) => use(new DummyServer()),
	client: ({ server, fileId }, use) => use(mockClient(fileId, server)),
	provider: async ({ client }, use) => {
		const provider = new HttpProvider(new Y.Doc(), client)
		await use(provider)
		provider.destroy()
	},
})

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.restoreAllMocks()
})

test('sends updates', async ({ client, provider }) => {
	await provider.connect()
	updateDoc(provider)
	vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledWith(provider.connection, {
		sync: provider.syncUpdate,
		awareness: provider.awarenessUpdate,
		clientId: provider.doc.clientID,
	})
	const sync = client.sync.mock.lastCall?.[1].sync ?? ''
	expect(docWith(sync)).toEqual(provider.doc)
	expect(provider.syncUpdate).not.toBe('')
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	expect(provider.syncUpdate).toBe('')
})

test('sends pending updates after connecting', async ({ client, provider }) => {
	updateDoc(provider)
	expect(provider.syncUpdate).toBeTruthy
	expect(client.sync).not.toHaveBeenCalled()
	await provider.connect()
	expect(client.sync).toHaveBeenCalledWith(provider.connection, {
		sync: provider.syncUpdate,
		awareness: provider.awarenessUpdate,
		clientId: provider.doc.clientID,
	})
})

test('include an awareness message', async ({ client, provider }) => {
	updateAwareness(provider)
	await provider.connect()
	expect(client.sync).toHaveBeenCalledTimes(1)
	const { awareness, sync } = client.sync.mock.lastCall?.[1] ?? {}
	// awareness update only
	expect(sync).toEqual('')
	const message = fromBase64(awareness as string)
	expect(message[0]).toBe(messageAwareness)
})

Object.entries({ doc: updateDoc, awareness: updateAwareness }).forEach(
	([key, updateFn]) => {
		test(`${key} changes trigger sync with interval`, async ({ client, provider }) => {
			await provider.connect()
			expect(client.sync).toHaveBeenCalledTimes(1)
			updateFn(provider)
			updateFn(provider)
			expect(client.sync).toHaveBeenCalledTimes(1)
			vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
			expect(client.sync).toHaveBeenCalledTimes(2)
		})
	},
)

test('sends awareness update every 10 seconds', async ({ client, provider }) => {
	updateAwareness(provider)
	await provider.connect()
	expect(client.sync).toHaveBeenCalledTimes(1)
	vi.advanceTimersByTime(MAX_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledTimes(2)
	const { awareness, sync } = client.sync.mock.lastCall?.[1] ?? {}
	// awareness update only
	expect(sync).toEqual('')
	const message = fromBase64(awareness as string)
	expect(message[0]).toBe(messageAwareness)
	vi.advanceTimersByTime(3 * MAX_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledTimes(5)
})

test.todo('do not resend received updates')
test.todo('resend updates send during failed request')
