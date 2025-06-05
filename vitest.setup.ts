import { Doc } from 'yjs'
import { expect } from 'vitest'

function areDocsEqual(a: unknown, b: unknown): boolean | undefined {
    const isADoc = a instanceof Doc
    const isBDoc = b instanceof Doc
    if (isADoc && isBDoc) {
        return JSON.stringify(a.getMap())
            === JSON.stringify(b.getMap())
    }
}
expect.addEqualityTesters([areDocsEqual])