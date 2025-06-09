import { SyncResponse } from '../src/y-http.ts'
import { randomDelay } from './helpers.ts'

export class DummyServer {
	syncStorage = new Map<number, Map<number, string[]>>()
	awarenessStorage = new Map<number, Map<number, string>>()
	versions = new Map<number, number>()

	receive(
		con: { fileId?: number },
		data: { sync: string[]; awareness: string; clientId: number },
	) {
		const syncMap = this.#sync(con)
		const awarenessMap = this.#awareness(con)
		if (data.sync[0]) {
			const version = this.versions.get(con.fileId ?? 0) ?? 0
			const newVersion = version + Math.floor(Math.random() * 100)
			this.versions.set(con.fileId ?? 0, newVersion)
			syncMap.set(newVersion, data.sync)
		}
		awarenessMap.set(data.clientId, data.awareness)
	}

	async respond(con: { fileId?: number }, since: number): Promise<SyncResponse> {
		const sync = Array.from(this.#sync(con).entries())
			.filter(([id, _data]) => id >= since)
			.map(([_id, data]) => data)
			.flat()
		const awareness = Object.fromEntries(this.#awareness(con))
		const version = this.versions.get(con.fileId ?? 0) ?? 0
		await randomDelay()
		return { sync, awareness, version }
	}

	#sync(con: { fileId?: number }): Map<number, string[]> {
		const id = con.fileId ?? 0
		const existing = this.syncStorage.get(id)
		if (existing) {
			return existing
		}
		const blank = new Map<number, string[]>()
		this.syncStorage.set(id, blank)
		return blank
	}

	#awareness(con: { fileId?: number }): Map<number, string> {
		const id = con.fileId ?? 0
		const existing = this.awarenessStorage.get(id)
		if (existing) {
			return existing
		}
		const blank = new Map<number, string>()
		this.awarenessStorage.set(id, blank)
		return blank
	}
}
