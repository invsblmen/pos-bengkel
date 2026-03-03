import React from 'react'
import { Link } from '@inertiajs/react';
import { IconChevronRight, IconChevronLeft } from '@tabler/icons-react';

export default function Pagination({ links }) {
    if (!links || links.length <= 3) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-6 px-4 py-4">
            <ul className="flex items-center gap-1.5">
                {links.map((item, i) => {
                    if (item.url === null) {
                        // Disabled item
                        return (
                            <li key={i}>
                                <span className="px-2.5 py-1.5 text-sm rounded-lg text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50">
                                    {item.label.includes('Previous') ? (
                                        <IconChevronLeft size={18} strokeWidth={1.5} />
                                    ) : item.label.includes('Next') ? (
                                        <IconChevronRight size={18} strokeWidth={1.5} />
                                    ) : (
                                        item.label
                                    )}
                                </span>
                            </li>
                        );
                    }

                    // Previous button
                    if (item.label.includes('Previous')) {
                        return (
                            <li key={i}>
                                <Link
                                    href={item.url}
                                    className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                                    title="Previous"
                                >
                                    <IconChevronLeft size={18} strokeWidth={1.5} />
                                </Link>
                            </li>
                        );
                    }

                    // Next button
                    if (item.label.includes('Next')) {
                        return (
                            <li key={i}>
                                <Link
                                    href={item.url}
                                    className="inline-flex items-center justify-center p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                                    title="Next"
                                >
                                    <IconChevronRight size={18} strokeWidth={1.5} />
                                </Link>
                            </li>
                        );
                    }

                    // Page number
                    return (
                        <li key={i}>
                            <Link
                                href={item.url}
                                className={`inline-flex items-center justify-center min-w-10 h-10 px-2.5 rounded-lg text-sm font-medium transition-all ${
                                    item.active
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20 font-semibold'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md'
                                }`}
                                dangerouslySetInnerHTML={{ __html: item.label }}
                            />
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
