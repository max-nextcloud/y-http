import * as Y from 'yjs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HttpProvider, messageAwareness } from '../src/y-http'
import { DummyServer } from './DummyServer.ts'
import { mockClient } from './mockClient.ts'
import { updateDoc, docWith, updateAwareness } from './helpers.ts'
import { fromBase64 } from 'lib0/buffer.js'

beforeEach(() => vi.useFakeTimers)

afterEach(() => vi.restoreAllMocks())

test('Instantiating the provider with a doc', () => {
	const doc = new Y.Doc()
	const provider = new HttpProvider(doc, mockClient())
	expect(provider.doc).toBe(doc)
	expect(provider.syncUpdate).toBeFalsy
	expect(provider.version).toBe(0)
})

test('exposes sync updates', () => {
	const provider = new HttpProvider(new Y.Doc(), mockClient())
	updateDoc(provider)
	expect(docWith([provider.syncUpdate])).toEqual(provider.doc)
})

test('exposes awareness message', () => {
	const provider = new HttpProvider(new Y.Doc(), mockClient())
	provider.awareness.setLocalStateField('user', { name: 'me' })
	expect(typeof provider.awarenessUpdate).toBe('string')
	const message = fromBase64(provider.awarenessUpdate as string)
	expect(message[0]).toBe(messageAwareness)
})

test('tracks version from sync', async () => {
	const server = new DummyServer()
	const client = mockClient(server)
	const provider = new HttpProvider(new Y.Doc(), client)
	updateDoc(provider)
	await provider.connect()
	expect(provider.version).toBeGreaterThan(0)
	expect(provider.version).toBe(server.version)
})

test('applies updates received from sync', async () => {
	const server = new DummyServer([
		'AAIxAQPYidydCwAHAQdkZWZhdWx0AwlwYXJhZ3JhcGgHANiJ3J0LAAYEANiJ3J0LAQFIAA==',
		'AAISAQHYidydCwOE2IncnQsCAWkA',
	])
	const client = mockClient(server)
	const provider = new HttpProvider(new Y.Doc(), client)
	updateDoc(provider)
	await provider.connect()
	expect(provider.doc.getXmlFragment('default')).toMatchInlineSnapshot(
		`"<paragraph>Hi</paragraph>"`,
	)
	expect(client.sync).toHaveBeenCalledOnce()
})

test('syncs docs via server on connection', async () => {
	const server = new DummyServer()
	const provider1 = new HttpProvider(new Y.Doc(), mockClient(server))
	const provider2 = new HttpProvider(new Y.Doc(), mockClient(server))
	updateDoc(provider1)
	await provider1.connect()
	await provider2.connect()
	expect(provider2.doc).toEqual(provider1.doc)
})

test('syncs awareness via server on connection', async () => {
	const server = new DummyServer()
	const provider1 = new HttpProvider(new Y.Doc(), mockClient(server))
	const provider2 = new HttpProvider(new Y.Doc(), mockClient(server))
	expect(provider2.awareness.getStates().size).toEqual(1)
	updateAwareness(provider1)
	await provider1.connect()
	await provider2.connect()
	expect(provider2.awareness.getStates().size).toEqual(2)
})
