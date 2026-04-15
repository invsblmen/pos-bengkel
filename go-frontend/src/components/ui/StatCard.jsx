import React from 'react'

export default function StatCard({ label, value, tone = 'slate', icon, description }) {
  const toneStyles = {
    slate: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    primary: 'border-primary-200 bg-primary-50 dark:border-primary-900/40 dark:bg-primary-900/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20',
    danger: 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/20',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20',
  }

  const valueStyles = {
    slate: 'text-slate-900 dark:text-slate-100',
    primary: 'text-primary-800 dark:text-primary-100',
    warning: 'text-amber-900 dark:text-amber-100',
    danger: 'text-rose-900 dark:text-rose-100',
    success: 'text-emerald-900 dark:text-emerald-100',
  }

  const labelStyles = {
    slate: 'text-slate-500 dark:text-slate-400',
    primary: 'text-primary-700 dark:text-primary-200',
    warning: 'text-amber-700 dark:text-amber-200',
    danger: 'text-rose-700 dark:text-rose-200',
    success: 'text-emerald-700 dark:text-emerald-200',
  }

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneStyles[tone] || toneStyles.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.16em] ${labelStyles[tone] || labelStyles.slate}`}>{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${valueStyles[tone] || valueStyles.slate}`}>{value}</p>
          {description ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-slate-700 ring-1 ring-black/5 dark:bg-slate-950/30 dark:text-slate-200 dark:ring-white/10">
            {icon}
          </div>
        ) : null}
      </div>
    </article>
  )
}
