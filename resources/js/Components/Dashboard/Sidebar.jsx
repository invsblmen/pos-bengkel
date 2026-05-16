import React from "react";
import { usePage } from "@inertiajs/react";
import { IconHeartFilled, IconRotate } from "@tabler/icons-react";
import LinkItem from "@/Components/Dashboard/LinkItem";
import LinkItemDropdown from "@/Components/Dashboard/LinkItemDropdown";
import SidebarSearch from "@/Components/Dashboard/SidebarSearch";
import Menu from "@/Utils/Menu";
import { useSidebar } from "@/Context/SidebarContext";
import { useKeyboardShortcuts } from "@/Hooks/useKeyboardShortcuts";
import { flattenSidebarItems } from "@/Utils/sidebarShortcuts";

export default function Sidebar({ sidebarOpen }) {
    const { auth } = usePage().props;
    const menuNavigation = Menu();
    const { favorites, searchQuery, resetSidebarPreferences } = useSidebar();
    const pinnedItems = flattenSidebarItems(menuNavigation).filter((item) =>
        favorites.includes(item.href)
    );

    // Initialize keyboard shortcuts
    useKeyboardShortcuts(menuNavigation);

    return (
        <div
            className={`
            ${sidebarOpen ? "w-[260px]" : "w-[80px]"}
            hidden md:flex flex-col h-screen print:hidden
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

            {/* Search Bar */}
            <SidebarSearch
                sidebarOpen={sidebarOpen}
                menuItems={menuNavigation}
                onItemClick={() => {
                    // Optionally close search after selection
                }}
            />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 scrollbar-sidebar">
                {!searchQuery && pinnedItems.length > 0 && (
                    <div className="mb-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                        {sidebarOpen && (
                            <div className="px-4 py-2 flex items-center gap-2">
                                <IconHeartFilled size={12} className="text-red-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                                    Menu Dipin
                                </span>
                            </div>
                        )}

                        <div className={sidebarOpen ? "" : "flex flex-col items-center"}>
                            {pinnedItems.map((item) => (
                                <LinkItem
                                    key={`pinned-${item.href}`}
                                    title={item.title}
                                    icon={item.icon}
                                    href={item.href}
                                    access={true}
                                    sidebarOpen={sidebarOpen}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {menuNavigation.map((section, index) => {
                    const hasPermission = section.details.some(
                        (detail) => detail.permissions === true
                    );
                    if (!hasPermission) return null;

                    // Filter items based on search query
                    const filteredDetails = searchQuery
                        ? section.details.filter(detail => {
                            if (!detail.permissions) return false;
                            if (detail.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                                return true;
                            }
                            if (detail.subdetails) {
                                return detail.subdetails.some(sub =>
                                    sub.permissions && sub.title.toLowerCase().includes(searchQuery.toLowerCase())
                                );
                            }
                            return false;
                        })
                        : section.details;

                    // If no items match search, skip section
                    if (filteredDetails.length === 0 && searchQuery) {
                        return null;
                    }

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
                                {(searchQuery ? filteredDetails : section.details).map((detail, idx) => {
                                    if (!detail.permissions) return null;

                                    if (detail.hasOwnProperty("subdetails")) {
                                        const forceOpen = Boolean(
                                            searchQuery &&
                                            (
                                                detail.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                detail.subdetails.some((sub) =>
                                                    sub.permissions && sub.title.toLowerCase().includes(searchQuery.toLowerCase())
                                                )
                                            )
                                        );

                                        return (
                                            <LinkItemDropdown
                                                key={idx}
                                                title={detail.title}
                                                icon={detail.icon}
                                                data={detail.subdetails}
                                                access={detail.permissions}
                                                sidebarOpen={sidebarOpen}
                                                sidebarKey={`${section.title}::${detail.title}`}
                                                forceOpen={forceOpen}
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
                                            target={detail.target}
                                            rel={detail.rel}
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
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] text-slate-400 dark:text-slate-600">
                            Point of Sales v2.0
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                const confirmed = window.confirm(
                                    "Reset semua preferensi sidebar?"
                                );

                                if (confirmed) {
                                    resetSidebarPreferences();
                                }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                            title="Reset sidebar memory"
                        >
                            <IconRotate size={12} strokeWidth={1.8} />
                            Reset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
