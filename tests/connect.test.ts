import { beforeEach, expect, vi } from 'vitest'
import { providerTest } from './providerTest.ts'

const test = providerTest

beforeEach(() => vi.resetAllMocks())

test('connect using the client', ({ provider, client }) => {
	provider.connect()
	expect(client.open).toHaveBeenCalled()
	expect(client.open.mock.lastCall).toEqual([undefined])
})

test('exposes connection', async ({ provider, fileId }) => {
	const { connection } = await provider.connect()
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

test('disconnect without connect returns', async ({ provider }) => {
	await provider.disconnect()
	expect(provider.connection).toBeFalsy()
})

test('clears connection on disconnect', async ({ provider }) => {
	await provider.connect()
	await provider.disconnect()
	expect(provider.connection).toBeFalsy()
})

test('Recovers connection', async ({ client, provider, fileId }) => {
	await provider.connect()
	await provider.disconnect()
	const { connection } = await provider.connect()
	expect(client.open.mock.lastCall).toEqual([connection])
	expect(provider.connection).toBe(connection)
	expect(connection).toEqual({ fileId })
})
