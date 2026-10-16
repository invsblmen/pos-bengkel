import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return;
                    }

                    const modulePath = id.replace(/\\/g, '/');

                    if (
                        modulePath.includes('/react/') ||
                        modulePath.includes('/react-dom/') ||
                        modulePath.includes('/scheduler/')
                    ) {
                        return 'vendor-react';
                    }

                    if (
                        modulePath.includes('/@inertiajs/') ||
                        modulePath.includes('/laravel-vite-plugin/')
                    ) {
                        return 'vendor-inertia';
                    }

                    if (modulePath.includes('/@headlessui/')) {
                        return 'vendor-headlessui';
                    }

                    if (modulePath.includes('/@tabler/icons-react/')) {
                        return 'vendor-icons';
                    }

                    if (modulePath.includes('/chart.js/')) {
                        return 'vendor-chart';
                    }

                    if (modulePath.includes('/sweetalert2/')) {
                        return 'vendor-alerts';
                    }

                    if (
                        modulePath.includes('/axios/') ||
                        modulePath.includes('/lodash/') ||
                        modulePath.includes('/es-toolkit/')
                    ) {
                        return 'vendor-utils';
                    }
                },
            },
        },
    },
    server: {
        // Enable CORS for all origins (useful for local development)
        cors: true,

        // OR, if you need to be specific for security:
        // proxy: {
        //   // Proxy API requests if you are accessing a backend server
        // }
    },
});
