import { fromBase64, toBase64 } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'
import { createEncoder, Encoder, toUint8Array, writeVarUint, writeVarUint8Array } from 'lib0/encoding.js'
import { ObservableV2 } from 'lib0/observable.js'
import { readUpdate, writeUpdate } from 'y-protocols/sync.js'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'


interface Connection {}

interface YHttpClient {
    open: (clientId: number) => Promise<Connection>,
    sync: (connection: Connection, data?: string[]) => Promise<syncResponse>,
}

interface syncResponse {
    data: string[],
    version: number,
}

interface Events {
    'connection-error': (error: Error, provider: HttpProvider) => any,
}

export const messageSync = 0
export const messageQueryAwareness = 3
export const messageAwareness = 1
export const messageAuth = 2

export const MIN_INTERVAL_BETWEEN_SYNCS = 100 // milliseconds

export class HttpProvider extends ObservableV2<Events> {
    doc: Y.Doc
    #remoteDoc: Y.Doc
    client: YHttpClient
    version = 0
    connection?: Connection
    #lastSync = 0
    #pendingSync = 0
    awareness: Awareness

    constructor(doc: Y.Doc, client: YHttpClient) {
        super()
        this.doc = doc
        this.awareness = new Awareness(doc)
        this.#remoteDoc = new Y.Doc()
        this.client = client
        doc.on('updateV2', (_update, origin) => {
            if (origin !== this) {
                console.log('update')
                this.#triggerSync()
            }
        })
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
        const now = Date.now()
        const data = [
            this.syncUpdate,
            this.awarenessUpdate,
        ].filter(u => u) as string[] // filter out the undefined and empty entries.
        const response = await this.client.sync(
            this.connection,
            data,
        )
        this.#lastSync = now
        response?.data?.forEach(update => {
            const arr = fromBase64(update)
            this.#applyUpdate(this.#remoteDoc, arr)
            this.#applyUpdate(this.doc, arr)
        })
        if (response?.version) {
            this.version = response.version
        }
    }

    #applyUpdate(doc: Y.Doc, arr: Uint8Array<ArrayBufferLike>) {
        const dec = new Decoder(arr)
        if (readUint8(dec) !== messageSync) {
            return
        }
        readUint8(dec) // 2 = update
        readUpdate(dec, doc, this)
    }

    get syncUpdate() {

        const remoteStateVec = Y.encodeStateVector(this.#remoteDoc)
        const update = Y.encodeStateAsUpdate(this.doc, remoteStateVec)
        // leave out empty updates.
        if (update.length === 2) {
            return ''
        }
        const enc = new Encoder()
        writeVarUint(enc, messageSync)
        writeUpdate(enc, update)
        const arr = toUint8Array(enc)
        return toBase64(arr)
    }

    get awarenessUpdate() {
        if (this.awareness.getLocalState() === null) {
            return
        }
        const enc = createEncoder()
        writeVarUint(enc, messageAwareness)
        writeVarUint8Array(
            enc,
            encodeAwarenessUpdate(
                this.awareness,
                [ this.doc.clientID ],
            ),
        )
        const arr = toUint8Array(enc)
        return toBase64(arr)
    }

    async connect(): Promise<void> {
        this.connection = await this.client.open(this.doc.clientID)
            ?.catch(err => {
                this.emit('connection-error', [err, this])
                return undefined
            })
        this.#sync()
    }
}