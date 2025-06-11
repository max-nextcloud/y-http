import { vi, expect, type Mock } from 'vitest'
import { randomDelay } from './helpers.ts'
import type { SyncData, SyncResponse, YHttpClient } from '../src/y-http.ts'

export interface Backend {
	respondTo: (req: SyncData) => Promise<SyncResponse>
}

type YHttpClientMock = YHttpClient & {
	sync: Mock<YHttpClient["sync"]>,
	open: Mock<YHttpClient["open"]>
	close: Mock<YHttpClient["close"]>
}

export function mockClient(fileId: number, server: Backend): YHttpClientMock {
	const open = vi.fn(async (_) => ({ fileId }))
	const close = vi.fn(async (_) => ({ }))
	const sync = vi.fn(async (con, data) => {
		expect(con.fileId).toBe(fileId)
		await randomDelay()
		return server.respondTo(data)
	})
	return { open, sync, close }
}
