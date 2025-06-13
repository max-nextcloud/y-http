import { vi, expect, type Mock } from 'vitest'
import { randomDelay } from './helpers.ts'
import type { SyncData, SyncResponse, YHttpClient } from '../src/y-http.ts'

export interface Backend {
	respondTo: (req: SyncData) => Promise<SyncResponse>
}

export interface DummyConnection {
	fileId: number
}

type YHttpClientMock = YHttpClient<DummyConnection> & {
	sync: Mock<YHttpClient<DummyConnection>['sync']>
	open: Mock<YHttpClient<DummyConnection>['open']>
	close: Mock<YHttpClient<DummyConnection>['close']>
}

export function mockClient(fileId: number, server: Backend): YHttpClientMock {
	const open = vi.fn(async (_) => ({ connection: { fileId }, data: {} }))
	const close = vi.fn(async (_) => ({}))
	const sync = vi.fn(async (con, data) => {
		expect(con.fileId).toBe(fileId)
		await randomDelay()
		return server.respondTo(data)
	})
	return { open, sync, close }
}
