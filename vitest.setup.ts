import { Doc } from 'yjs'
import { expect } from 'vitest'

function areDocsEqual(a: unknown, b: unknown): boolean | undefined {
	const isADoc = a instanceof Doc
	const isBDoc = b instanceof Doc
	if (isADoc && isBDoc) {
		const aMap = a.getMap()
		const bMap = b.getMap()
		for (let key of aMap.keys()) {
			if (aMap.get(key) != bMap.get(key)) {
				return false
			}
		}
		return aMap.size === bMap.size
	}
}
expect.addEqualityTesters([areDocsEqual])
