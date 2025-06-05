import { vi } from 'vitest'
import { DummyServer } from './DummyServer.ts'

export function mockApi(server?: DummyServer) {
    const _connection = {}
    const open = vi.fn()
    open.mockResolvedValue(_connection)
    const sync = vi.fn()
    if (server) {
        sync.mockImplementation(async (_url, _con, updates) => {
            server.receive(updates)
            // TODO: handle version arg to sync
            return server.respond(0)
        })
    }
    return { open, sync, _connection }
}