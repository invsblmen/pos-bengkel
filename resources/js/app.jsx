import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { ThemeSwitcherProvider } from './Context/ThemeSwitcherContext';
import { SidebarProvider } from './Context/SidebarContext';
import DashboardLayout from './Layouts/DashboardLayout';
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const dashboardLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: async (name) => {
        const page = await resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx')
        );

        if ((name === 'Dashboard' || name.startsWith('Dashboard/')) && page?.default) {
            page.default.layout = dashboardLayout;
        }

        return page;
    },
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeSwitcherProvider>
                <SidebarProvider>
                    <App {...props} />
                </SidebarProvider>
            </ThemeSwitcherProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
