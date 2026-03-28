import React from 'react';
import { IconCurrencyDollar, IconPercentage } from '@tabler/icons-react';

export default function DiscountModeToggle({
    mode = 'nominal',
    onChange,
    className = ''
}) {
    const isNominal = mode === 'nominal';

    return (
        <div className={`inline-flex h-10 items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-1.5 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
            <button
                type="button"
                onClick={() => onChange('nominal')}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md leading-none transition-all ${
                    isNominal
                        ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Diskon Nominal (Rp)"
            >
                <IconCurrencyDollar size={16} />
            </button>
            <button
                type="button"
                onClick={() => onChange('percent')}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md leading-none transition-all ${
                    !isNominal
                        ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Diskon Persen (%)"
            >
                <IconPercentage size={16} />
            </button>
        </div>
    );
}
