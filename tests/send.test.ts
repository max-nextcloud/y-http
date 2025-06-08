import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
	HttpProvider,
	messageAwareness,
	MIN_INTERVAL_BETWEEN_SYNCS,
} from '../src/y-http'
import { mockClient } from './mockClient.ts'
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
		'AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA==',
		'AAISAQHYidydCwOE2IncnQsCAWkA',
	])
	const client = mockClient(server)
	const provider = new HttpProvider(new Y.Doc(), client)
	await provider.connect()
	update(provider.doc)
	vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledWith(client._connection, [
		provider.syncUpdate,
		provider.awarenessUpdate,
	])
	const updates = client.sync.mock.lastCall?.[1]
	expect(updates.length).toBe(2) // awareness and sync
	expect(docWith(updates)).toEqual(provider.doc)
	expect(provider.doc.getXmlFragment('default')).toMatchInlineSnapshot(
		`"<paragraph>Hi</paragraph>"`,
	)
	await vi.waitUntil(() => !provider.syncUpdate)
	expect(provider.syncUpdate).toBe('')
})

test('sends pending updates after connecting', async () => {
	const client = mockClient()
	const provider = new HttpProvider(new Y.Doc(), client)
	update(provider.doc)
	expect(provider.syncUpdate).toBeTruthy
	expect(client.sync).not.toHaveBeenCalled()
	await provider.connect()
	expect(client.sync).toHaveBeenCalledWith(client._connection, [
		provider.syncUpdate,
		provider.awarenessUpdate,
	])
})

test('send at most one request every maxFrequency ms', async () => {
	const client = mockClient()
	const provider = new HttpProvider(new Y.Doc(), client)
	await provider.connect()
	expect(client.sync).toHaveBeenCalledTimes(1)
	update(provider.doc)
	update(provider.doc)
	expect(client.sync).toHaveBeenCalledTimes(1)
	vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledTimes(2)
})

test('include an awareness message', async () => {
	const client = mockClient()
	const provider = new HttpProvider(new Y.Doc(), client)
	provider.awareness.setLocalStateField('user', { name: 'me' })
	await provider.connect()
	expect(client.sync).toHaveBeenCalledTimes(1)
	const updates = client.sync.mock.lastCall?.[1]
	// awareness update only
	expect(updates.length).toBe(1)
	const message = fromBase64(updates[0])
	expect(message[0]).toBe(messageAwareness)
})

test('awareness updates trigger sync', async () => {
	const client = mockClient()
	const provider = new HttpProvider(new Y.Doc(), client)
	provider.awareness.setLocalStateField('user', { name: 'me', pos: 123 })
	await provider.connect()
	expect(client.sync).toHaveBeenCalledTimes(1)
	provider.awareness.setLocalStateField('user', { name: 'me', pos: 124 })
	provider.awareness.setLocalStateField('user', { name: 'me', pos: 125 })
	expect(client.sync).toHaveBeenCalledTimes(1)
	vi.advanceTimersByTime(MIN_INTERVAL_BETWEEN_SYNCS)
	expect(client.sync).toHaveBeenCalledTimes(2)
})

test.todo('do not resend received updates')
test.todo('resend updates send during failed request')
