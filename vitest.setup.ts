import { Doc } from 'yjs'
import { beforeAll, expect, vi } from 'vitest'

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

/* Make fake timers work inside lib0/time
 * and thus in y-protocols/awareness.js.
 * Requires the module that imports lib0/time to be in server.deps.inline
 * (See https://github.com/vitest-dev/vitest/issues/8146)
 */
beforeAll(() => {
	vi.mock('lib0/time', async (importOriginal) => ({
		...(await importOriginal<typeof import('lib0/time')>()),
		getUnixTime: () =>
			vi.isFakeTimers()
				? vi.getMockedSystemTime()?.valueOf()
				: vi.getRealSystemTime()?.valueOf(),
	}))
})
