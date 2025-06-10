import { vi, expect } from 'vitest'
import { randomDelay } from './helpers.ts'
import type { YHttpClient } from '../src/y-http.ts'

interface Request {
    sync: string
	awareness: string
	clientId: number
}

interface Response {
	sync: string[]
	awareness: {}
	version: number
}

export interface Backend {
	respondTo: (req: Request) => Promise<Response>
}

const nullBackend: Backend = {
	respondTo: vi.fn(async (_req) => ({
		sync: [],
		awareness: {},
		version: 0,
	}))
}

export function mockClient(fileId: number, server: Backend = nullBackend) {
	const open = vi.fn<YHttpClient['open']>(async () => ({ fileId }))
	const sync = vi.fn<YHttpClient['sync']>(async (con, data) => {
		expect(con.fileId).toBe(fileId)
		await randomDelay()
		return server.respondTo(data)
	})
	return { open, sync }
}
