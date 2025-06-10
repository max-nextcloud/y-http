import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test as baseTest, vi } from 'vitest'
import {
	HttpProvider,
	MAX_INTERVAL_BETWEEN_SYNCS,
	messageAwareness,
} from '../src/y-http'
import { DummyServer } from './DummyServer.ts'
import { mockClient } from './mockClient.ts'
import { updateDoc, docWith, updateAwareness, randomFileId } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'

interface ProviderFixture {
	fileId: number
	server: DummyServer
	providers: HttpProvider[]
	provider: HttpProvider
}

const test = baseTest.extend<ProviderFixture>({
	fileId: ({ task: _ }, use) => use(randomFileId()),
	server: ({ task: _ }, use) => use(new DummyServer()),
	providers: async ({ fileId, server }, use) => {
		const providers: HttpProvider[] = []
		providers.push(new HttpProvider(new Y.Doc(), mockClient({ server, fileId })))
		providers.push(new HttpProvider(new Y.Doc(), mockClient({ server, fileId })))
		await use(providers)
		providers.forEach((p) => p.destroy)
	},
	provider: async ({ providers }, use) => {
		await use(providers[0])
	},
})

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.restoreAllMocks()
})

test('Instantiating the provider with a doc', ({ provider }) => {
	expect(provider.syncUpdate).toBeFalsy
	expect(provider.version).toBe(0)
})

test('exposes sync updates', ({ provider }) => {
	updateDoc(provider)
	expect(docWith([provider.syncUpdate])).toEqual(provider.doc)
})

test('exposes awareness message', ({ provider }) => {
	provider.awareness.setLocalStateField('user', { name: 'me' })
	const message = fromBase64(provider.awarenessUpdate)
	expect(message[0]).toBe(messageAwareness)
})

test('tracks version from sync', async ({ provider, server }) => {
	updateDoc(provider)
	await provider.connect()
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	expect(provider.version).toBeGreaterThan(0)
	expect(provider.version).toBe(server.version)
})

test('applies updates received from sync', async ({ server, provider }) => {
	server.seed(
		'AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA==',
		'AAISAQHYidydCwOE2IncnQsCAWkA',
	)
	provider.connect()
	updateDoc(provider)
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	expect(provider.doc.getXmlFragment('default')).toMatchInlineSnapshot(
		`"<paragraph>Hi</paragraph>"`,
	)
})

test('syncs docs via server within one interval', async ({ providers }) => {
	providers.map(updateDoc)
	providers.forEach((p) => p.connect())
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	expect(providers[1].doc).toEqual(providers[0].doc)
})

test('syncs awareness via server on connection', async ({ providers }) => {
	providers.map(updateAwareness)
	providers.forEach((p) => p.connect())
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	await vi.advanceTimersByTimeAsync(MAX_INTERVAL_BETWEEN_SYNCS)
	expect(providers[1].awareness.getStates().size).toEqual(2)
	expect(providers[1].awareness.getStates()).toEqual(
		providers[0].awareness.getStates(),
	)
})
