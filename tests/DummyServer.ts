import { SyncResponse } from '../src/y-http.ts'
import { randomDelay } from './helpers.ts'

export class DummyServer {
	#fileId?: number
	syncMap = new Map<number, string[]>()
	awarenessMap = new Map<number, string>()
	version = 0

	seed(...sync: string[]) {
		sync.forEach(str => {
			this.version += Math.floor(Math.random() * 100)
			this.syncMap.set(this.version, [str])
		})
	}

	receive(
		con: { fileId?: number },
		data: { sync: string[]; awareness: string; clientId: number },
	) {
		this.#checkConnection(con)
		if (data.sync[0]) {
			this.version += Math.floor(Math.random() * 100)
			this.syncMap.set(this.version, data.sync)
		}
		this.awarenessMap.set(data.clientId, data.awareness)
	}

	async respond(con: { fileId?: number }, since: number): Promise<SyncResponse> {
		this.#checkConnection(con)
		const sync = Array.from(this.syncMap.entries())
			.filter(([id, _data]) => id >= since)
			.map(([_id, data]) => data)
			.flat()
		const awareness = Object.fromEntries(this.awarenessMap)
		const version = this.version
		await randomDelay()
		return { sync, awareness, version }
	}

	/**
	 * Ensure we always use the same file.
	 * For the sake of simplicity DummyServer only handles one file.
	 */
	#checkConnection({ fileId = 0 }: { fileId?: number }) {
		this.#fileId ??= fileId
		if (this.#fileId != fileId) {
			throw new Error('Inconsistent file ids in dummy storage')
		}
	}

}
