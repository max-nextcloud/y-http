import { expect } from 'vitest'
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { fromBase64 } from 'lib0/buffer.js'
import { Decoder, readUint8 } from 'lib0/decoding.js'
import { messageSync } from '../src/y-http.ts'

export function docWith(updates: string[]): Y.Doc {
	const dest = new Y.Doc()
	updates.forEach((u) => receive(dest, u))
	return dest
}

export function receive(dest: Y.Doc, data: string) {
	const dec = new Decoder(fromBase64(data))
	if (readUint8(dec) !== messageSync) {
		return
	}
	// so far we only send updates
	expect(readUint8(dec)).toBe(2)
	sync.readUpdate(dec, dest, 'test')
}

let _updateCount = 0
export function update(doc: Y.Doc) {
	doc.getMap().set(`update-${_updateCount++}`, 'world')
}
