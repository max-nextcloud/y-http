import { type Mock, test as baseTest, vi } from 'vitest'
import { type YHttpClient, HttpProvider } from '../src/y-http.ts'
import { randomFileId } from './helpers.ts'
import { Backend, mockClient } from './mockClient.ts'
import { Doc } from 'yjs'

interface ProviderFixture {
	fileId: number
	client: { sync: Mock<YHttpClient["sync"]>, open: Mock<YHttpClient["open"]> }
	provider: HttpProvider
	backend: Backend
}

export const providerTest = baseTest.extend<ProviderFixture>({
	fileId: randomFileId(),
	backend: ({ task: _ }, use) => use(nullBackend),
	client: ({ fileId, backend }, use) => use(mockClient(fileId, backend)),
	provider: useProvider,
})

export async function useProvider({ client }, use) {
	const provider = new HttpProvider(new Doc(), client)
	await use(provider)
	provider.destroy()
}

const nullBackend: Backend = {
	respondTo: vi.fn(async (_req) => ({
		sync: [],
		awareness: {},
		version: 0,
	}))
}
