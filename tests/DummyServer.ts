import { SyncData, SyncResponse } from '../src/y-http.ts'
import { Backend } from './mockClient.ts'

export class DummyServer implements Backend {
	syncMap = new Map<number, string>()
	awarenessMap = new Map<number, string>()
	version = 0
	fileId?: number

	seed(...sync: string[]) {
		sync.forEach((str) => {
			this.version += Math.floor(Math.random() * 100)
			this.syncMap.set(this.version, str)
		})
	}

	async respondTo(req: SyncData): Promise<SyncResponse> {
		this.fileId ??= req.connection.fileId
		if (this.fileId !== req.connection.fileId) {
			throw new Error('Dummy server can only serve one file')
		}
		if (req.sync) {
			this.version += Math.floor(Math.random() * 100)
			this.syncMap.set(this.version, req.sync)
		}
		this.awarenessMap.set(req.clientId, req.awareness)
		const sync = Array.from(this.syncMap.entries())
			.filter(([id, _data]) => id > req.version)
			.map(([_id, data]) => data)
			.flat()
		const awareness = Object.fromEntries(this.awarenessMap)
		const version = this.version
		return { sync, awareness, version }
	}
}
