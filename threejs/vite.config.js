import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                about: resolve(__dirname, 'about.html'),
                feedback: resolve(__dirname, 'feedback.html'),
            }
        }
    },
    server: {
        // Vite runs on its own port (default 5173)
        // Forward all /api/* requests to the Express backend
        proxy: {
            '/api': {
                target: 'http://localhost:3000', // same port as the Express app
                changeOrigin: true,
                secure: false,
            },
        },
    },
});