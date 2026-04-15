import React from 'react'

export default function Card({ title, icon, children, footer, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {title ? (
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {icon ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-900/50">
                {icon}
              </div>
            ) : null}
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            </div>
          </div>
        </div>
      ) : null}
      <div className="px-5 py-5">{children}</div>
      {footer ? <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">{footer}</div> : null}
    </section>
  )
}
