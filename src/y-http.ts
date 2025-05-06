import { ObservableV2 } from 'lib0/observable.js'
import * as Y from 'yjs'

interface Connection {}

interface HttpApi {
    open?: (url: string) => Promise<Connection>,
    // TODO: send actually returns updates
    send: (url: string, connection: Connection, data?: Uint8Array[]) => Promise<void>,
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
        this.triggerSend = (_update?: Uint8Array) => {
            if (this.connection) {
                this.api.send(
                    this.url,
                    this.connection,
                    [ this.syncUpdate ],
                )
            } else {
                this.pendingSend = true
            }
        }
        doc.on('updateV2', this.triggerSend)

    }

    get syncUpdate() {
        // TODO: encode a proper message,
        // TODO: Maybe return undefined if no update
        return Y.encodeStateAsUpdateV2(this.doc, Y.encodeStateVector(this.#remoteDoc))
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