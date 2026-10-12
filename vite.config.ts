import {fileURLToPath, URL} from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import {defineConfig} from 'vitest/config'

import {config} from './src/shared/config.ts'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {alias: {'@': fileURLToPath(new URL('./src', import.meta.url))}},
    server: {
        host: config.host,
        port: config.port,
        strictPort: true,
        proxy: {
            [config.llmProxyPath]: {
                target: config.apiBaseUrl,
                changeOrigin: true,
                rewrite: (path) => path.slice(config.llmProxyPath.length),
            },
        },
    },
    test: {environment: 'jsdom', setupFiles: ['./src/testSetup.ts']},
})
