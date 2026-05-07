import React, { useMemo } from 'react';
import { useSidebar } from '@/Context/SidebarContext';
import { IconSearch, IconX } from '@tabler/icons-react';
import { Link } from '@inertiajs/react';

export default function SidebarSearch({ sidebarOpen, menuItems, onItemClick }) {
    const { searchQuery, setSearchQuery } = useSidebar();

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const query = searchQuery.toLowerCase();
        const results = [];

        menuItems.forEach(section => {
            section.details.forEach(detail => {
                if (detail.permissions && detail.title.toLowerCase().includes(query)) {
                    results.push({
                        type: 'item',
                        title: detail.title,
                        href: detail.href,
                        section: section.title,
                    });
                }

                if (detail.subdetails) {
                    detail.subdetails.forEach(sub => {
                        if (sub.permissions && sub.title.toLowerCase().includes(query)) {
                            results.push({
                                type: 'subitem',
                                title: sub.title,
                                href: sub.href,
                                section: section.title,
                            });
                        }
                    });
                }
            });
        });

        return results;
    }, [searchQuery, menuItems]);

    if (!sidebarOpen) return null;

    return (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
                <IconSearch
                    size={16}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-600"
                />
                <input
                    data-keyboard-search
                    type="text"
                    placeholder="Alt+S untuk cari menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <IconX size={16} />
                    </button>
                )}
            </div>

            {/* Search Results */}
            {searchQuery && (
                <div className="absolute top-16 left-3 right-3 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                    {searchResults.length > 0 ? (
                        <div className="py-1">
                            {searchResults.map((result, idx) => (
                                <Link
                                    key={idx}
                                    href={result.href}
                                    onClick={onItemClick}
                                    className="flex flex-col px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-950/30 text-slate-700 dark:text-slate-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                >
                                    <span className="font-medium">{result.title}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {result.section}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                            Tidak ada hasil untuk "{searchQuery}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
