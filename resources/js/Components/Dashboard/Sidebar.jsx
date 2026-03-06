import React from "react";
import { usePage } from "@inertiajs/react";
import { IconLayoutGrid } from "@tabler/icons-react";
import LinkItem from "@/Components/Dashboard/LinkItem";
import LinkItemDropdown from "@/Components/Dashboard/LinkItemDropdown";
import Menu from "@/Utils/Menu";

export default function Sidebar({ sidebarOpen }) {
    const { auth } = usePage().props;
    const menuNavigation = Menu();

    return (
        <div
            className={`
            ${sidebarOpen ? "w-[260px]" : "w-[80px]"}
            hidden md:flex flex-col h-screen
            border-r border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900
            transition-all duration-300 ease-in-out
        `}
        >
            {/* Logo */}
            <div className="flex items-center justify-center h-16 border-b border-slate-100 dark:border-slate-800">
                {sidebarOpen ? (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                                K
                            </span>
                        </div>
                        <span className="text-xl font-bold text-slate-800 dark:text-white">
                            KASIR
                        </span>
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">K</span>
                    </div>
                )}
            </div>

            {/* User Info */}
            <div
                className={`
                p-3 border-b border-slate-100 dark:border-slate-800
                ${
                    sidebarOpen
                        ? "flex items-center gap-3"
                        : "flex justify-center"
                }
            `}
            >
                <img
                    src={
                        auth.user.avatar ||
                        `https://ui-avatars.com/api/?name=${auth.user.name}&background=6366f1&color=fff`
                    }
                    className={`rounded-full ring-2 ring-slate-100 dark:ring-slate-800 ${
                        sidebarOpen ? "w-10 h-10" : "w-8 h-8"
                    }`}
                    alt={auth.user.name}
                />
                {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {auth.user.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {auth.user.email}
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 scrollbar-sidebar">
                {menuNavigation.map((section, index) => {
                    const hasPermission = section.details.some(
                        (detail) => detail.permissions === true
                    );
                    if (!hasPermission) return null;

                    return (
                        <div key={index} className="mb-2">
                            {/* Section Title */}
                            {sidebarOpen && (
                                <div className="px-4 py-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                                        {section.title}
                                    </span>
                                </div>
                            )}

                            {/* Menu Items */}
                            <div
                                className={
                                    sidebarOpen
                                        ? ""
                                        : "flex flex-col items-center"
                                }
                            >
                                {section.details.map((detail, idx) => {
                                    if (!detail.permissions) return null;

                                    if (detail.hasOwnProperty("subdetails")) {
                                        return (
                                            <LinkItemDropdown
                                                key={idx}
                                                title={detail.title}
                                                icon={detail.icon}
                                                data={detail.subdetails}
                                                access={detail.permissions}
                                                sidebarOpen={sidebarOpen}
                                            />
                                        );
                                    }

                                    return (
                                        <LinkItem
                                            key={idx}
                                            title={detail.title}
                                            icon={detail.icon}
                                            href={detail.href}
                                            access={detail.permissions}
                                            disableWhenActive={detail.disableWhenActive}
                                            sidebarOpen={sidebarOpen}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Version/Footer */}
            {sidebarOpen && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center">
                        Point of Sales v2.0
                    </p>
                </div>
            )}
        </div>
    );
}
