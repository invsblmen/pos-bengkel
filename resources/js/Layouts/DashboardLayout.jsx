import React, { useEffect, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import Sidebar from "@/Components/Dashboard/Sidebar";
import Navbar from "@/Components/Dashboard/Navbar";
import { Toaster } from "react-hot-toast";
import { useTheme } from "@/Context/ThemeSwitcherContext";

export default function AppLayout({ children }) {
    const { darkMode, themeSwitcher } = useTheme();
    const { url } = usePage();
    const reloadTimerRef = useRef(null);

    const [sidebarOpen, setSidebarOpen] = useState(
        localStorage.getItem("sidebarOpen") === "true"
    );

    useEffect(() => {
        localStorage.setItem("sidebarOpen", sidebarOpen);
    }, [sidebarOpen]);

    const shouldEnableGlobalRealtime = useMemo(() => {
        if (!url?.startsWith("/dashboard")) return false;

        // Keep print pages stable during printing.
        return !/\/print$/.test(url);
    }, [url]);

    useEffect(() => {
        if (!shouldEnableGlobalRealtime) return;
        if (!window.Echo) return;

        const subscriptions = [
            { channel: "workshop.customers", events: ["customer.created", "customer.updated", "customer.deleted"] },
            { channel: "workshop.vehicles", events: ["vehicle.created", "vehicle.updated", "vehicle.deleted"] },
            { channel: "workshop.suppliers", events: ["supplier.created", "supplier.updated", "supplier.deleted"] },
            { channel: "workshop.mechanics", events: ["mechanic.created", "mechanic.updated", "mechanic.deleted"] },
            { channel: "workshop.services", events: ["service.created", "service.updated", "service.deleted"] },
            { channel: "workshop.servicecategories", events: ["servicecategory.created", "servicecategory.updated", "servicecategory.deleted"] },
            { channel: "workshop.partcategories", events: ["partcategory.created", "partcategory.updated", "partcategory.deleted"] },
            { channel: "workshop.parts", events: ["part.created", "part.updated", "part.deleted"] },
            { channel: "workshop.vouchers", events: ["voucher.created", "voucher.updated", "voucher.deleted"] },
            { channel: "workshop.serviceorders", events: ["serviceorder.created", "serviceorder.updated", "serviceorder.deleted"] },
            { channel: "workshop.appointments", events: ["appointment.created", "appointment.updated", "appointment.deleted"] },
            { channel: "workshop.partpurchases", events: ["partpurchase.created", "partpurchase.updated"] },
            { channel: "workshop.partpurchaseorders", events: ["partpurchaseorder.created", "partpurchaseorder.deleted"] },
            { channel: "workshop.partsales", events: ["partsale.created", "partsale.updated", "partsale.deleted"] },
            { channel: "workshop.partsalesorders", events: ["partsalesorder.created", "partsalesorder.deleted"] },
        ];

        const listeners = [];

        const scheduleReload = () => {
            if (reloadTimerRef.current) {
                clearTimeout(reloadTimerRef.current);
            }

            reloadTimerRef.current = setTimeout(() => {
                router.reload({
                    preserveScroll: true,
                    preserveState: true,
                });
            }, 700);
        };

        subscriptions.forEach(({ channel, events }) => {
            const echoChannel = window.Echo.channel(channel);

            events.forEach((eventName) => {
                const prefixedEvent = `.${eventName}`;
                echoChannel.listen(prefixedEvent, scheduleReload);
                listeners.push({ echoChannel, prefixedEvent });
            });
        });

        return () => {
            if (reloadTimerRef.current) {
                clearTimeout(reloadTimerRef.current);
            }

            listeners.forEach(({ echoChannel, prefixedEvent }) => {
                echoChannel.stopListening(prefixedEvent);
            });
        };
    }, [shouldEnableGlobalRealtime]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="h-screen overflow-hidden flex bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar sidebarOpen={sidebarOpen} />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Navbar
                    toggleSidebar={toggleSidebar}
                    themeSwitcher={themeSwitcher}
                    darkMode={darkMode}
                />
                <main className="flex-1 overflow-y-auto">
                    <div className="w-full py-6 px-4 md:px-6 lg:px-8 pb-20 md:pb-6">
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                className: "text-sm",
                                duration: 3000,
                                style: {
                                    background: darkMode ? "#1e293b" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    border: `1px solid ${
                                        darkMode ? "#334155" : "#e2e8f0"
                                    }`,
                                    borderRadius: "12px",
                                },
                            }}
                        />
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
