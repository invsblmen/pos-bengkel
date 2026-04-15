import Link from 'next/link'

const VARIANTS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-900/10',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-900/10',
}

const SIZES = {
  sm: 'px-3 py-2 text-sm rounded-xl',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-5 py-3 text-base rounded-xl',
}

export default function Button({
  children,
  href,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  icon,
  ...props
}) {
  const baseClass = `inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`

  if (href) {
    return (
      <Link href={href} className={baseClass} {...props}>
        {icon}
        <span>{children}</span>
      </Link>
    )
  }

  return (
    <button type={type} className={baseClass} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      <span>{children}</span>
    </button>
  )
}
