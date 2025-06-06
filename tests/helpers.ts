import { expect } from 'vitest'
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { fromBase64, } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'

export const anyUpdates = [ expect.any(String) ]

export function docWith(updates: string[]): Y.Doc {
    const dest = new Y.Doc()
    updates.forEach(u => receive(dest, u))
    return dest
}

export function receive(dest: Y.Doc, data: string) {
    const dec = new Decoder(fromBase64(data))
    expect(readUint8(dec)).toBe(0)
    expect(readUint8(dec)).toBe(2)
    sync.readUpdate(dec, dest, 'test')
}

let _updateCount = 0
export function update(doc: Y.Doc) {
    doc.getMap().set(`update-${_updateCount++}`, 'world')
}