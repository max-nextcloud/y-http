import { afterEach, beforeEach, expect, vi } from 'vitest'
import {
	MAX_INTERVAL_BETWEEN_SYNCS,
	messageAwareness,
	MIN_INTERVAL_BETWEEN_SYNCS,
} from '../src/y-http'
import { updateDoc, docWith, updateAwareness, waitForSync, updateDocAndSync } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'
import { DummyServer } from './DummyServer.ts'
import { providerTest } from './providerTest.ts'

const test = providerTest
test.scoped({ backend: ( { task: _ }, use ) => use(new DummyServer()) })

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.restoreAllMocks()
})

test('sends updates', async ({ client, provider }) => {
	await provider.connect()
	await waitForSync()
	updateDoc(provider)
	expect(client.sync).toHaveBeenCalledWith(provider.connection, {
		sync: provider.syncUpdate,
		awareness: provider.awarenessUpdate,
		clientId: provider.doc.clientID,
		version: 0,
	})
	const sync = client.sync.mock.lastCall?.[1].sync ?? ''
	expect(docWith(sync)).toEqual(provider.doc)
})

test('sync empties syncUpdate', async ({ provider }) => {
	await provider.connect()
	await waitForSync()
	updateDoc(provider)
	expect(provider.syncUpdate).not.toBe('')
	await waitForSync()
	expect(provider.syncUpdate).toBe('')
})

test('receives only new updates', async ({ client, provider }) => {
	updateDoc(provider)
	await provider.connect()
	await waitForSync()
	expect(client.sync.mock.settledResults.at(0)?.value.sync.length).toBe(1)
	await updateDocAndSync(provider)
	expect(client.sync.mock.settledResults.at(1)?.value.sync.length).toBe(1)
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
		version: 0,
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
		test(`${key} changes trigger sync after interval`, async ({ client, provider }) => {
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
