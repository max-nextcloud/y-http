import { vi, expect } from 'vitest'
import { randomDelay } from './helpers.ts'
import type { SyncData, SyncResponse, YHttpClient } from '../src/y-http.ts'

export interface Backend {
	respondTo: (req: SyncData) => Promise<SyncResponse>
}

export function mockClient(fileId: number, server: Backend) {
	const open = vi.fn<YHttpClient['open']>(async () => ({ fileId }))
	const sync = vi.fn<YHttpClient['sync']>(async (con, data) => {
		expect(con.fileId).toBe(fileId)
		await randomDelay()
		return server.respondTo(data)
	})
	return { open, sync }
}
