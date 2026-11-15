import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { ThemeSwitcherProvider } from './Context/ThemeSwitcherContext';
import { SidebarProvider } from './Context/SidebarContext';
import DashboardLayout from './Layouts/DashboardLayout';
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const pages = import.meta.glob('./Pages/**/*.jsx');
const dashboardLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;
const dashboardLayoutExclusions = new Set([
    'Dashboard/ServiceOrders/Create',
    'Dashboard/ServiceOrders/Edit',
    'Dashboard/ServiceOrders/Print',
    'Dashboard/Parts/Sales/Print',
    'Dashboard/PartPurchases/Print',
]);

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: async (name) => {
        const page = await resolvePageComponent(
            `./Pages/${name}.jsx`,
            pages
        );

        if (
            (name === 'Dashboard' || name.startsWith('Dashboard/')) &&
            !dashboardLayoutExclusions.has(name) &&
            page?.default
        ) {
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
