import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
	HttpProvider,
	messageAwareness,
	MIN_INTERVAL_BETWEEN_SYNCS,
} from '../src/y-http'
import { mockClient } from './mockClient.ts'
import { updateDoc, docWith, updateAwareness } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'
import { DummyServer } from './DummyServer.ts'

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.restoreAllMocks()
})

test('sends updates', async () => {
	const server = new DummyServer()
	const client = mockClient(server)
	const provider = new HttpProvider(new Y.Doc(), client)
	await provider.connect()
	updateDoc(provider)
	vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledWith(client._connection, [
		provider.syncUpdate,
		provider.awarenessUpdate,
	])
	const updates = client.sync.mock.lastCall?.[1]
	expect(updates.length).toBe(2) // awareness and sync
	expect(docWith(updates)).toEqual(provider.doc)
	await vi.waitUntil(() => !provider.syncUpdate)
	expect(provider.syncUpdate).toBe('')
})

test('sends pending updates after connecting', async () => {
	const client = mockClient()
	const provider = new HttpProvider(new Y.Doc(), client)
	updateDoc(provider)
	expect(provider.syncUpdate).toBeTruthy
	expect(client.sync).not.toHaveBeenCalled()
	await provider.connect()
	expect(client.sync).toHaveBeenCalledWith(client._connection, [
		provider.syncUpdate,
		provider.awarenessUpdate,
	])
})

test('include an awareness message', async () => {
	const client = mockClient()
	const provider = new HttpProvider(new Y.Doc(), client)
	updateAwareness(provider)
	await provider.connect()
	expect(client.sync).toHaveBeenCalledTimes(1)
	const updates = client.sync.mock.lastCall?.[1]
	// awareness update only
	expect(updates.length).toBe(1)
	const message = fromBase64(updates[0])
	expect(message[0]).toBe(messageAwareness)
})

Object.entries({doc: updateDoc, awareness: updateAwareness})
	.forEach(([key, fn]) => {
		test(`${key} changes trigger sync with interval`, async () => {
			const client = mockClient()
			const provider = new HttpProvider(new Y.Doc(), client)
			await provider.connect()
			expect(client.sync).toHaveBeenCalledTimes(1)
			updateDoc(provider)
			updateDoc(provider)
			expect(client.sync).toHaveBeenCalledTimes(1)
			vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
			expect(client.sync).toHaveBeenCalledTimes(2)
		})
})

test.todo('do not resend received updates')
test.todo('resend updates send during failed request')
