import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // ...other Vite options
    base: '/',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                about: resolve(__dirname, 'about.html'),
                feedback: resolve(__dirname, 'feedback.html'),
            }
        }
    }
});