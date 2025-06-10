import { expect } from 'vitest'
import * as Y from 'yjs'
import * as sync from 'y-protocols/sync'
import { fromBase64 } from 'lib0/buffer.js'
import { createDecoder, readUint8 } from 'lib0/decoding.js'
import { HttpProvider, messageSync } from '../src/y-http.ts'
import { Awareness } from 'y-protocols/awareness.js'

// continue after up to 100ms
export function randomDelay() {
	return new Promise((resolve) => {
		setTimeout(resolve, Math.random() * 100)
	})
}

export function docWith(...updates: string[]): Y.Doc {
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

export const randomFileId = () => Math.floor(Math.random() * 1_000_000)

export function updateDocAndSync(provider: HttpProvider) {
	updateDoc(provider)
	return waitForSync(provider)
}

export function waitForSync(provider: HttpProvider) {
	return new Promise<void>((resolve) => {
		function onSync(state) {
			if (state) {
				provider.off('sync', onSync)
				resolve()
			}
		}
		provider.on('sync', onSync)
	})
}

let _pos = 123
export function updateAwareness({ awareness }: { awareness: Awareness }) {
	const name = 'user-' + awareness.doc.clientID
	awareness.setLocalStateField('user', { name, pos: _pos++ })
}
