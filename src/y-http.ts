import { fromBase64, toBase64 } from 'lib0/buffer.js'
import {
	clone,
	createDecoder,
	Decoder,
	readUint8,
	readVarUint8Array,
} from 'lib0/decoding.js'
import {
	createEncoder,
	toUint8Array,
	writeVarUint,
	writeVarUint8Array,
} from 'lib0/encoding.js'
import { ObservableV2 } from 'lib0/observable.js'
import { readUpdate, writeUpdate } from 'y-protocols/sync.js'
import {
	applyAwarenessUpdate,
	Awareness,
	encodeAwarenessUpdate,
	outdatedTimeout,
} from 'y-protocols/awareness'
import * as Y from 'yjs'

export interface Connection {
	fileId?: number
	baseVersionEtag: string
}

export interface YHttpClient {
	open: (clientId: number, prev?: Connection) => Promise<Connection>
	sync: (connection: Connection, data: SyncData) => Promise<SyncResponse>
	close: (connection: Connection) => Promise<{}>
}

export interface SyncData {
	sync: string
	awareness: string
	clientId: number
	version: number
}

export interface SyncResponse {
	sync: string[]
	awareness: { [k: string]: string }
	version: number
}

interface Events {
	'connection-error': (error: Error, provider: HttpProvider) => any
	sync: (state: boolean) => any
}

export const messageSync = 0
export const messageAwareness = 1
export const messageAuth = 2
export const messageQueryAwareness = 3

// throttle requests to at most 5 per second
export const MIN_INTERVAL_BETWEEN_SYNCS = 200 // milliseconds
// The awareness state autoupdates every 15 seconds.
export const MAX_INTERVAL_BETWEEN_SYNCS = outdatedTimeout / 2

export class HttpProvider extends ObservableV2<Events> {
	doc: Y.Doc
	#remoteDoc: Y.Doc
	client: YHttpClient
	version = 0
	#connection?: Connection
	#isConnected = false
	#lastSync = 0
	#pendingSync = 0
	awareness: Awareness
	#messageHandlers: ((this: HttpProvider, dec: Decoder) => void)[] = []
	_synced = false

	constructor(doc: Y.Doc, client: YHttpClient) {
		super()
		this.doc = doc
		this.awareness = new Awareness(doc)
		this.#remoteDoc = new Y.Doc()
		this.client = client
		doc.on('updateV2', (_update, origin): void => {
			if (origin !== this) {
				this.synced = false
				this.#triggerSync()
			}
		})
		this.awareness.on('update', (_update: any, origin: any): void => {
			if (origin !== this) {
				this.#triggerSync()
			}
		})
		this.#messageHandlers[messageSync] = this.#handleSyncMessage
		this.#messageHandlers[messageAwareness] = this.#handleAwarenessMessage
	}

	#triggerSync() {
		if (this.#pendingSync) {
			return
		}
		const waitTime = this.#lastSync + MIN_INTERVAL_BETWEEN_SYNCS - Date.now()
		if (waitTime < 1) {
			this.#sync()
			return
		}
		this.#pendingSync = setTimeout(() => this.#sync(), waitTime)
	}

	async #sync() {
		if (!this.connection) {
			return
		}
		const data = {
			sync: this.syncUpdate,
			awareness: this.awarenessUpdate,
			clientId: this.doc.clientID,
			version: this.version,
			connection: this.connection,
		}
		this.#lastSync = Date.now()
		const response = await this.client.sync(this.connection, data)
		const messages: string[] = [
			...response.sync,
			...Object.values(response.awareness),
		] // todo check awareness clientIds
		messages.forEach((encoded) => {
			const message = fromBase64(encoded)
			this.#receive(message)
		})
		if (response?.version) {
			this.version = response.version
		}
		this.synced = true
	}

	#receive(message: Uint8Array<ArrayBufferLike>) {
		const dec = createDecoder(message)
		const kind = readUint8(dec)
		this.#messageHandlers[kind]?.apply(this, [dec])
	}

	#handleSyncMessage(dec: Decoder) {
		readUint8(dec) // 2 = update
		const dec2 = clone(dec)
		readUpdate(dec, this.doc, this)
		readUpdate(dec2, this.#remoteDoc, this)
	}

	#handleAwarenessMessage(dec: Decoder) {
		applyAwarenessUpdate(this.awareness, readVarUint8Array(dec), this)
	}

	get connection() {
		return this.#isConnected ? this.#connection : undefined
	}

	get synced() {
		return this._synced
	}

	set synced(state) {
		if (this._synced !== state) {
			this._synced = state
			this.emit('sync', [state])
		}
	}

	get syncUpdate(): string {
		const remoteStateVec = Y.encodeStateVector(this.#remoteDoc)
		const update = Y.encodeStateAsUpdate(this.doc, remoteStateVec)
		// leave out empty updates.
		if (update.length === 2) {
			return ''
		}
		const enc = createEncoder()
		writeVarUint(enc, messageSync)
		writeUpdate(enc, update)
		const arr = toUint8Array(enc)
		return toBase64(arr)
	}

	get awarenessUpdate(): string {
		if (this.awareness.getLocalState() === null) {
			return ''
		}
		const enc = createEncoder()
		writeVarUint(enc, messageAwareness)
		writeVarUint8Array(
			enc,
			encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
		)
		const arr = toUint8Array(enc)
		return toBase64(arr)
	}

	async connect(): Promise<Connection> {
		this.#connection = await this.client
			.open(this.doc.clientID, this.#connection)
			.catch((err) => {
				this.emit('connection-error', [err, this])
				throw err
			})
		this.#isConnected = true
		this.#sync()
		return this.#connection
	}

	async disconnect() {
		if (!this.connection) {
			return
		}
		await this.client.close(this.connection).catch((err) => {
			this.emit('connection-error', [err, this])
		})
		// we keep the connection around so we can hand it to the reconnect attempt.
		this.#isConnected = false
	}

	destroy(): void {}
}
