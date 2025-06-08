import { expect } from 'vitest'
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { fromBase64 } from 'lib0/buffer.js'
import { createDecoder, readUint8 } from 'lib0/decoding.js'
import { messageSync } from '../src/y-http.ts'
import { Awareness } from 'y-protocols/awareness.js'

export function docWith(updates: string[]): Y.Doc {
	const dest = new Y.Doc()
	updates.forEach((u) => receive(dest, u))
	return dest
}

export function receive(dest: Y.Doc, data: string) {
	const dec = createDecoder(fromBase64(data))
	if (readUint8(dec) !== messageSync) {
		return
	}
	// so far we only send updates
	expect(readUint8(dec)).toBe(2)
	sync.readUpdate(dec, dest, 'test')
}

let _updateCount = 0
export function updateDoc({ doc }: { doc: Y.Doc }) {
	doc.getMap().set(`update-${_updateCount++}`, 'world')
}

let _pos = 123
export function updateAwareness({ awareness }: { awareness: Awareness }) {
	awareness.setLocalStateField('user', { name: 'me', pos: _pos++ })
}
