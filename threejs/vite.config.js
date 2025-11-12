import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                about: resolve(__dirname, 'about.html'),
                feedback: resolve(__dirname, 'feedback.html'),
                tutorial: resolve(__dirname, 'tutorial.html'),
                404: resolve(__dirname, '404.html'),
            }
        }
    },
    server: {
        // Vite runs on its own port (default 5173)
        // Forward all /api/* requests to the feedback handler
        // This is necessary to have the feedback properly working
        proxy: {
            '/api': {
                target: 'http://localhost:3000', // same port as the feedback app
                changeOrigin: true,
                secure: false,
            },
        },
    },
});