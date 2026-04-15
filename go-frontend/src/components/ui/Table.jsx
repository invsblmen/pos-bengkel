import React from 'react'

function Table({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function Thead({ children, className = '' }) {
  return <thead className={`bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300 ${className}`}>{children}</thead>
}

function Tbody({ children, className = '' }) {
  return <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${className}`}>{children}</tbody>
}

function Tr({ children, className = '' }) {
  return <tr className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${className}`}>{children}</tr>
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</th>
}

function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 align-middle text-slate-700 dark:text-slate-300 ${className}`}>{children}</td>
}

function Empty({ children, colSpan = 1 }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        {children}
      </td>
    </tr>
  )
}

Table.Thead = Thead
Table.Tbody = Tbody
Table.Tr = Tr
Table.Th = Th
Table.Td = Td
Table.Empty = Empty

export default Table
