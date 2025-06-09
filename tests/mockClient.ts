import { vi } from 'vitest'
import { DummyServer } from './DummyServer.ts'
import { YHttpClient } from '../src/y-http.ts'

export function mockClient({
	server,
	fileId,
}: { server?: DummyServer; fileId?: number } = {}) {
	const _connection = { fileId }
	const open = vi.fn<YHttpClient['open']>()
	open.mockResolvedValue(_connection)

	const sync = vi.fn<YHttpClient['sync']>(async () => ({
		sync: [],
		awareness: {},
		version: 0,
	}))
	if (server) {
		sync.mockImplementation(async (con, data) => {
			server.receive(con, data)
			// TODO: handle version arg to sync
			return server.respond(_connection, 0)
		})
	}
	return { open, sync }
}
