import { fromBase64, toBase64 } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'
import { Encoder, toUint8Array, writeVarUint } from 'lib0/encoding.js'
import { ObservableV2 } from 'lib0/observable.js'
import { readUpdate, writeUpdate } from 'y-protocols/sync.js'
import * as Y from 'yjs'

interface Connection {}

interface HttpApi {
    open?: (url: string) => Promise<Connection>,
    send: (url: string, connection: Connection, data?: string[]) => Promise<string[]>,
}

interface Events {
    'connection-error': (error: Error, provider: HttpProvider) => any,
}


export class HttpProvider extends ObservableV2<Events> {
    url: string
    doc: Y.Doc
    #remoteDoc: Y.Doc
    api: HttpApi
    connection?: Connection
    triggerSend?: (update?: Uint8Array) => void
    // TODO: drop in favor of checking for updates
    pendingSend = false

    constructor(url: string, doc: Y.Doc, api: HttpApi) {
        super()
        this.url = url
        this.doc = doc
        this.#remoteDoc = new Y.Doc()
        this.api = api
        this.triggerSend = async (_update?: Uint8Array) => {
            if (this.connection) {
                const updates = await this.api.send(
                    this.url,
                    this.connection,
                    [ this.syncUpdate ],
                )
                ;(updates || []).forEach(update => {
                    const dec = new Decoder(fromBase64(update))
                    readUint8(dec) // 0 = sync protocol
                    readUint8(dec) // 2 = update
                    // readUpdate(dec, this.#remoteDoc, this)
                    readUpdate(dec, this.doc, this)
                })
            } else {
                this.pendingSend = true
            }
        }
        doc.on('updateV2', this.triggerSend)

    }

    get syncUpdate() {
        const update = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(this.#remoteDoc))
        const enc = new Encoder()
        writeVarUint(enc, 0) // sync protocol
        writeUpdate(enc, update)
        return toBase64(toUint8Array(enc))
    }

    async connect(): Promise<void> {
        this.connection = await this.api.open?.(this.url)
            ?.catch(err => {
                this.emit('connection-error', [err, this])
                return undefined
            })
        if(this.pendingSend){
            this.triggerSend?.()
        }
    }
}