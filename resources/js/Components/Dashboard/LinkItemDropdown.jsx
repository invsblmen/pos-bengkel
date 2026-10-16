import React, { useMemo } from 'react'
import { Link, usePage } from '@inertiajs/react'
import { IconChevronDown, IconChevronUp, IconCornerDownRight, IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { useSidebar } from '@/Context/SidebarContext'
import Menu from '@/Utils/Menu'
import { getComparableSidebarHref, getSidebarShortcutMap, isExternalSidebarHref } from '@/Utils/sidebarShortcuts'

export default function LinkItemDropdown({ icon, title, data, access, sidebarOpen, sidebarKey, forceOpen = false, ...props }) {

    // destruct url from usepage
    const { url } = usePage();

    // destruct auth from usepage props
    const { auth } = usePage().props;
    const { isFavorite, toggleFavorite, getDropdownState, toggleDropdownState } = useSidebar();
    const menuItems = Menu();

    const hasActiveChild = useMemo(() => {
        return data.some((item) => item.permissions === true && url.startsWith(getComparableSidebarHref(item.href)));
    }, [data, url]);

    const isOpen = forceOpen || getDropdownState(sidebarKey || title, hasActiveChild);

    // Get keyboard shortcut indices
    const shortcutIndices = useMemo(() => {
        return getSidebarShortcutMap(menuItems);
    }, [menuItems]);

    const handleFavoriteToggle = (e, href) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(href);
    };

    const renderExpandedItem = (dataItem, i) => {
        if (dataItem.permissions !== true) return null;

        const isFav = isFavorite(dataItem.href);
        const shortcutKey = shortcutIndices[dataItem.href];
        const comparableHref = getComparableSidebarHref(dataItem.href);
        const isItemActive = url === comparableHref;
        const isStaticOrExternal = isExternalSidebarHref(dataItem.href);
        const linkHref = isStaticOrExternal ? dataItem.href : comparableHref;
        const target = dataItem.target;
        const rel = dataItem.rel;

        const LinkComponent = isStaticOrExternal || target === '_blank' ? 'a' : Link;

        if (sidebarOpen) {
            return (
                <LinkComponent
                    key={i}
                    href={linkHref}
                    {...(LinkComponent === Link ? { prefetch: "hover" } : {})}
                    target={target}
                    rel={rel}
                    className={`${isItemActive && 'border-r-2 border-r-primary-500 bg-primary-50 text-primary-700 dark:border-r-primary-400 dark:bg-primary-950/50 dark:text-primary-400'} min-w-full flex items-center font-medium gap-x-3.5 px-5 py-3 hover:border-r-2 capitalize hover:cursor-pointer text-sm line-clamp-1 text-slate-600 hover:border-r-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:border-r-slate-200 dark:hover:text-slate-100 border-l-[3px] border-transparent transition-all group`}
                    title={shortcutKey ? `${dataItem.title} (Alt+${shortcutKey})` : dataItem.title}
                    {...props}>
                    <IconCornerDownRight size={18} strokeWidth={1.5} />
                    <span className="flex-1 truncate">{dataItem.title}</span>
                    <button
                        onClick={(e) => handleFavoriteToggle(e, dataItem.href)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                        {isFav ? (
                            <IconHeartFilled size={14} className="text-red-500" />
                        ) : (
                            <IconHeart size={14} className="text-slate-400" />
                        )}
                    </button>
                </LinkComponent>
            );
        } else {
            return (
                <LinkComponent
                    href={linkHref}
                    {...(LinkComponent === Link ? { prefetch: "hover" } : {})}
                    target={target}
                    rel={rel}
                    className={`${isItemActive && 'border-r-2 border-r-primary-500 bg-primary-50 text-primary-700 dark:border-r-primary-400 dark:bg-primary-950/50 dark:text-primary-400'} min-w-full flex justify-center py-3 hover:border-r-2 hover:cursor-pointer text-slate-600 hover:border-r-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:border-r-slate-200 dark:hover:text-slate-100 relative group transition-all`}
                    key={i}
                    title={shortcutKey ? `${dataItem.title} (Alt+${shortcutKey})` : dataItem.title}
                    {...props}>
                    {dataItem.icon}
                    {isFav && (
                        <IconHeartFilled size={12} className="absolute top-1 right-1 text-red-500" />
                    )}
                </LinkComponent>
            );
        }
    };

    return (
        <>
            {
                auth.super === true ?
                    sidebarOpen ?
                        <>
                            <button
                                className={`min-w-full flex items-center font-medium gap-x-3.5 px-4 py-3 hover:border-r-2 capitalize hover:cursor-pointer text-sm justify-between text-slate-600 hover:border-r-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:border-r-slate-200 dark:hover:text-slate-100 transition-all`}
                                onClick={() => toggleDropdownState(sidebarKey || title, hasActiveChild)}>
                                <div className='flex items-center gap-x-3.5'>{icon}{title}</div>
                                {isOpen ? (
                                    <IconChevronUp size={18} strokeWidth={1.5} />
                                ) : (
                                    <IconChevronDown size={18} strokeWidth={1.5} />
                                )}
                            </button>
                            {isOpen &&
                                data.map((dataItem, i) => renderExpandedItem(dataItem, i))
                            }
                        </>
                        :
                        <>
                            <button
                                className='min-w-full flex justify-center py-3 hover:border-r-2 item-navigation hover:cursor-pointer text-slate-600 hover:border-r-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:border-r-slate-200 dark:hover:text-slate-100 transition-all'
                                onClick={() => toggleDropdownState(sidebarKey || title, hasActiveChild)}>
                                {!isOpen ? icon : <IconChevronDown size={20} strokeWidth={1.5} />}
                            </button>
                            {isOpen &&
                                data.map((dataItem, i) => renderExpandedItem(dataItem, i))
                            }
                        </>
                    :
                    access === true &&
                        sidebarOpen ?
                        <>
                            <button
                                className={`min-w-full flex items-center font-medium gap-x-3.5 px-4 py-3 hover:border-r-2 capitalize hover:cursor-pointer text-sm justify-between text-slate-600 hover:border-r-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:border-r-slate-200 dark:hover:text-slate-100 transition-all`}
                                onClick={() => toggleDropdownState(sidebarKey || title, hasActiveChild)}>
                                <div className='flex items-center gap-x-3.5'>{icon}{title}</div>
                                {isOpen ? (
                                    <IconChevronUp size={18} strokeWidth={1.5} />
                                ) : (
                                    <IconChevronDown size={18} strokeWidth={1.5} />
                                )}
                            </button>
                            {isOpen &&
                                data.map((dataItem, i) => renderExpandedItem(dataItem, i))
                            }
                        </>
                        :
                        <>
                            <button
                                className='min-w-full flex justify-center py-3 hover:border-r-2 hover:cursor-pointer text-slate-600 hover:border-r-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:border-r-slate-200 dark:hover:text-slate-100 transition-all'
                                onClick={() => toggleDropdownState(sidebarKey || title, hasActiveChild)}>
                                {!isOpen ? icon : <IconChevronDown size={20} strokeWidth={1.5} />}
                            </button>
                            {isOpen &&
                                data.map((dataItem, i) => renderExpandedItem(dataItem, i))
                            }
                        </>
            }
        </>
    )
}
