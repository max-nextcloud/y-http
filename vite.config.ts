import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: `${__dirname}/src/y-http.ts`,
      name: 'y-http',
      fileName: 'y-http',
	  formats: ['es'],
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [],
    },
  },
  plugins: [dts()]
})
