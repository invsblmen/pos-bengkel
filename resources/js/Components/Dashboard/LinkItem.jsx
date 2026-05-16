import React, { useMemo } from "react";
import { Link, usePage } from "@inertiajs/react";
import { useSidebar } from "@/Context/SidebarContext";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import Menu from "@/Utils/Menu";
import {
    getComparableSidebarHref,
    getSidebarShortcutMap,
    isExternalSidebarHref,
} from "@/Utils/sidebarShortcuts";

export default function LinkItem({
    href,
    icon,
    access,
    title,
    disableWhenActive = false,
    sidebarOpen,
    target,
    rel,
    ...props
}) {
    const { url } = usePage();
    const { auth } = usePage().props;
    const { isFavorite, toggleFavorite } = useSidebar();

    const comparableHref = getComparableSidebarHref(href);
    const isActive = comparableHref ? url.startsWith(comparableHref) : false;
    const canAccess = auth.super === true || access === true;
    const isFav = isFavorite(href);

    const handleClick = (event) => {
        if (disableWhenActive && isActive) {
            event.preventDefault();
        }
    };

    const handleFavoriteToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(href);
    };

    // Get keyboard shortcut index
    const menuItems = Menu();
    const shortcutIndex = useMemo(() => {
        return getSidebarShortcutMap(menuItems)[href] || null;
    }, [menuItems]);

    const isStaticOrExternal = isExternalSidebarHref(href);
    const linkHref = isStaticOrExternal ? href : comparableHref;

    if (!canAccess) return null;

    const baseClasses = `
        flex items-center gap-3
        transition-all duration-200
        text-slate-600 dark:text-slate-400
        relative group
    `;

    const activeClasses = isActive
        ? "bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400 border-l-[3px] border-primary-500"
        : "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border-l-[3px] border-transparent";

    if (sidebarOpen) {
        if (isStaticOrExternal) {
            return (
                <a
                    href={href}
                    target={target}
                    rel={rel}
                    className={`${baseClasses} ${activeClasses} px-4 py-2.5 text-sm font-medium`}
                    onClick={handleClick}
                    title={shortcutIndex ? `${title} (Alt+${shortcutIndex})` : title}
                    {...props}
                >
                    <span
                        className={
                            isActive ? "text-primary-600 dark:text-primary-400" : ""
                        }
                    >
                        {icon}
                    </span>
                    <span className="truncate flex-1">{title}</span>
                    <button
                        onClick={handleFavoriteToggle}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                        {isFav ? (
                            <IconHeartFilled size={16} className="text-red-500" />
                        ) : (
                            <IconHeart size={16} className="text-slate-400" />
                        )}
                    </button>
                </a>
            );
        }

        return (
            <Link
                href={linkHref}
                target={target}
                rel={rel}
                className={`${baseClasses} ${activeClasses} px-4 py-2.5 text-sm font-medium`}
                onClick={handleClick}
                title={shortcutIndex ? `${title} (Alt+${shortcutIndex})` : title}
                {...props}
            >
                <span
                    className={
                        isActive ? "text-primary-600 dark:text-primary-400" : ""
                    }
                >
                    {icon}
                </span>
                <span className="truncate flex-1">{title}</span>
                <button
                    onClick={handleFavoriteToggle}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                    {isFav ? (
                        <IconHeartFilled size={16} className="text-red-500" />
                    ) : (
                        <IconHeart size={16} className="text-slate-400" />
                    )}
                </button>
            </Link>
        );
    }

    // Collapsed sidebar
    if (isStaticOrExternal) {
        return (
            <a
                href={href}
                target={target}
                rel={rel}
                className={`
                w-full flex justify-center py-3
                transition-all duration-200
                ${
                    isActive
                        ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }
                relative group
            `}
                title={shortcutIndex ? `${title} (Alt+${shortcutIndex})` : title}
                onClick={handleClick}
                {...props}
            >
                {icon}
                {isFav && (
                    <IconHeartFilled size={12} className="absolute top-1 right-1 text-red-500" />
                )}
            </a>
        );
    }

    return (
        <Link
            href={linkHref}
            target={target}
            rel={rel}
            className={`
                w-full flex justify-center py-3
                transition-all duration-200
                ${
                    isActive
                        ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }
                relative group
            `}
            title={shortcutIndex ? `${title} (Alt+${shortcutIndex})` : title}
            onClick={handleClick}
            {...props}
        >
            {icon}
            {isFav && (
                <IconHeartFilled size={12} className="absolute top-1 right-1 text-red-500" />
            )}
        </Link>
    );
}
