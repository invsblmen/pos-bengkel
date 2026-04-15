import React, { useMemo, useState, useEffect } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';
import Pagination from '@/Components/Dashboard/Pagination';
import Modal from '@/Components/Dashboard/Modal';
import toast from 'react-hot-toast';
import {
    IconCirclePlus,
    IconPencilCog,
    IconTrash,
    IconDatabaseOff,
    IconLayoutGrid,
    IconList,
    IconClock,
    IconCurrencyDollar,
    IconAdjustmentsHorizontal,
    IconBolt,
    IconCategory,
    IconSearch,
    IconChecks,
    IconX,
    IconArrowsSort,
    IconDownload,
    IconCategory2,
    IconTool,
} from '@tabler/icons-react';

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value);

const complexityBadge = {
    simple: { class: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300', label: 'Sederhana' },
    easy: { class: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300', label: 'Sederhana' },
    medium: { class: 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300', label: 'Menengah' },
    complex: { class: 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300', label: 'Kompleks' },
    hard: { class: 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300', label: 'Kompleks' },
};

const statusBadge = {
    active: { class: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300', label: 'Aktif' },
    inactive: { class: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300', label: 'Nonaktif' },
};

const sortOptions = [
    { key: 'latest', label: 'Terbaru' },
    { key: 'name-asc', label: 'Nama A-Z' },
    { key: 'name-desc', label: 'Nama Z-A' },
    { key: 'price-high', label: 'Harga Tertinggi' },
    { key: 'price-low', label: 'Harga Terendah' },
    { key: 'duration-long', label: 'Durasi Terlama' },
    { key: 'duration-short', label: 'Durasi Tersingkat' },
];

function StatCard({ title, value, icon, tone = 'primary' }) {
    const tones = {
        primary: 'from-primary-500/15 to-primary-500/5 text-primary-700 dark:text-primary-300 border-primary-200/60 dark:border-primary-800/70',
        success: 'from-success-500/15 to-success-500/5 text-success-700 dark:text-success-300 border-success-200/60 dark:border-success-800/70',
        warning: 'from-warning-500/15 to-warning-500/5 text-warning-700 dark:text-warning-300 border-warning-200/60 dark:border-warning-800/70',
        slate: 'from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800/80',
    };

    return (
        <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/60 p-2.5">{icon}</div>
            </div>
        </div>
    );
}

function ServiceCard({ service, checked, onToggle, isHighlighted }) {
    const complexity = complexityBadge[service.complexity_level] || complexityBadge.simple;
    const status = statusBadge[service.status] || statusBadge.active;

    return (
        <div className={`group relative rounded-2xl border overflow-hidden hover:shadow-lg transition-all duration-200 ${isHighlighted ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:shadow-amber-500/10' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-primary-500/10 hover:border-slate-300 dark:hover:border-slate-700'}`}>
            <div className="absolute top-3 left-3 z-10">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(service.id)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2 gap-2 pl-6">
                    <span className="px-2.5 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-md inline-flex items-center gap-1">
                        <span className="inline-flex items-center justify-center text-primary-600 dark:text-primary-300">
                            <IconTool size={12} />
                        </span>
                        <span>{service.category?.name || 'Tanpa Kategori'}</span>
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${status.class}`}>
                        {status.label}
                    </span>
                </div>
                <span className={`ml-6 px-2.5 py-1 text-xs font-semibold rounded-full ${complexity.class}`}>
                    {complexity.label}
                </span>
            </div>

            <div className="p-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1 line-clamp-2">{service.name}</h3>
                {service.description && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{service.description}</p>}
                <div className="mb-3">
                    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Kode: {service.code || `SVC-${service.id}`}
                    </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mb-3">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <IconClock size={16} />
                        <span className="text-sm font-medium">{service.duration} menit</span>
                    </div>
                    <div className="text-right">
                        <p className="text-base font-bold text-primary-600 dark:text-primary-400">{formatCurrency(service.price)}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={route('services.edit', service.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-warning-100 text-warning-600 hover:bg-warning-200 dark:bg-warning-900/50 dark:text-warning-400 text-sm font-medium transition-colors">
                        <IconPencilCog size={16} /> <span>Edit</span>
                    </Link>
                    <Button type="delete" icon={<IconTrash size={16} />} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-danger-100 text-danger-600 hover:bg-danger-200 dark:bg-danger-900/50 dark:text-danger-400 text-sm font-medium" url={route('services.destroy', service.id)} label="Hapus" />
                </div>
            </div>
        </div>
    );
}

function Index({ services, categories = [] }) {
    const [viewMode, setViewMode] = useState('grid');
    const [liveServices, setLiveServices] = useState(services?.data || []);
    const [quickSearch, setQuickSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [complexityFilter, setComplexityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortBy, setSortBy] = useState('latest');
    const [selectedIds, setSelectedIds] = useState([]);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const {
        data: quickData,
        setData: setQuickData,
        post: postQuickService,
        processing: quickProcessing,
        errors: quickErrors,
        reset: resetQuickForm,
    } = useForm({
        service_category_id: '',
        name: '',
        description: '',
        price: '',
        duration: '',
        complexity_level: 'simple',
        status: 'active',
        required_tools: [],
        incentive_mode: 'same',
        default_incentive_percentage: 0,
        price_adjustments: [],
        mechanic_incentives: [],
    });

    const computedSummary = useMemo(() => {
        const total = liveServices.length;
        const active = liveServices.filter((item) => item.status === 'active').length;
        const inactive = total - active;
        const avgPrice = total ? Math.round(liveServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0) / total) : 0;
        return { total, active, inactive, avgPrice };
    }, [liveServices]);

    const categoryOptions = useMemo(() => {
        return categories.map((category) => ({
            id: category.id,
            name: category.name,
        }));
    }, [categories]);

    const filteredServices = useMemo(() => {
        const normalizedSearch = quickSearch.trim().toLowerCase();
        let collection = [...liveServices];

        collection = collection.filter((item) => {
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;

            const normalizedComplexity = item.complexity_level === 'easy'
                ? 'simple'
                : item.complexity_level === 'hard'
                    ? 'complex'
                    : item.complexity_level;
            if (complexityFilter !== 'all' && normalizedComplexity !== complexityFilter) return false;

            if (categoryFilter !== 'all' && String(item.service_category_id || item.category?.id || '') !== categoryFilter) return false;

            if (normalizedSearch) {
                const haystack = [
                    item.name,
                    item.description,
                    item.category?.name,
                    item.code,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(normalizedSearch)) return false;
            }

            return true;
        });

        collection.sort((a, b) => {
            if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
            if (sortBy === 'price-high') return (Number(b.price) || 0) - (Number(a.price) || 0);
            if (sortBy === 'price-low') return (Number(a.price) || 0) - (Number(b.price) || 0);
            if (sortBy === 'duration-long') return (Number(b.duration) || 0) - (Number(a.duration) || 0);
            if (sortBy === 'duration-short') return (Number(a.duration) || 0) - (Number(b.duration) || 0);
            return (new Date(b.updated_at || b.created_at || 0)).getTime() - (new Date(a.updated_at || a.created_at || 0)).getTime();
        });

        return collection;
    }, [liveServices, quickSearch, statusFilter, complexityFilter, categoryFilter, sortBy]);

    const visibleSelectedIds = useMemo(() => {
        const visibleSet = new Set(filteredServices.map((item) => item.id));
        return selectedIds.filter((id) => visibleSet.has(id));
    }, [filteredServices, selectedIds]);

    const allVisibleSelected = filteredServices.length > 0 && visibleSelectedIds.length === filteredServices.length;
    const hasFilter = quickSearch || statusFilter !== 'all' || complexityFilter !== 'all' || categoryFilter !== 'all' || sortBy !== 'latest';

    const clearFilters = () => {
        setQuickSearch('');
        setStatusFilter('all');
        setComplexityFilter('all');
        setCategoryFilter('all');
        setSortBy('latest');
    };

    const toggleSelect = (serviceId) => {
        setSelectedIds((prev) => (prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]));
    };

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            const visibleSet = new Set(filteredServices.map((item) => item.id));
            setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
            return;
        }

        const merged = new Set([...selectedIds, ...filteredServices.map((item) => item.id)]);
        setSelectedIds(Array.from(merged));
    };

    const runBulkStatus = (status) => {
        if (selectedIds.length === 0) {
            toast.error('Pilih layanan terlebih dahulu.');
            return;
        }

        router.post(
            route('services.bulk-status'),
            { ids: selectedIds, status },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedIds([]);
                    toast.success(`Status ${selectedIds.length} layanan berhasil diperbarui.`);
                },
                onError: () => {
                    toast.error('Gagal memperbarui status layanan.');
                },
            }
        );
    };

    const runBulkDelete = () => {
        if (selectedIds.length === 0) {
            toast.error('Pilih layanan terlebih dahulu.');
            return;
        }

        if (!window.confirm(`Hapus ${selectedIds.length} layanan terpilih? Aksi ini tidak bisa dibatalkan.`)) {
            return;
        }

        router.post(
            route('services.bulk-delete'),
            { ids: selectedIds },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedIds([]);
                    toast.success('Bulk delete diproses.');
                },
                onError: () => {
                    toast.error('Bulk delete gagal dijalankan.');
                },
            }
        );
    };

    const downloadFile = (filename, content, mimeType) => {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const buildExportRows = () => {
        return filteredServices.map((item, index) => ({
            no: index + 1,
            code: item.code || `SVC-${item.id}`,
            name: item.name || '',
            category: item.category?.name || '-',
            price: Number(item.price) || 0,
            duration: Number(item.duration) || 0,
            complexity: complexityBadge[item.complexity_level]?.label || item.complexity_level || '-',
            status: statusBadge[item.status]?.label || item.status || '-',
            description: item.description || '',
        }));
    };

    const exportCsv = () => {
        const rows = buildExportRows();
        if (rows.length === 0) {
            toast.error('Tidak ada data untuk diekspor.');
            return;
        }

        const header = ['No', 'Kode', 'Nama Layanan', 'Kategori', 'Harga', 'Durasi (menit)', 'Kompleksitas', 'Status', 'Deskripsi'];
        const body = rows.map((row) => [
            row.no,
            row.code,
            row.name,
            row.category,
            row.price,
            row.duration,
            row.complexity,
            row.status,
            row.description.replace(/\n/g, ' '),
        ]);

        const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;
        const csvContent = [header, ...body].map((line) => line.map(escapeCsv).join(',')).join('\n');

        downloadFile(`services-export-${new Date().toISOString().slice(0, 10)}.csv`, csvContent, 'text/csv;charset=utf-8;');
        toast.success('Export CSV berhasil dibuat.');
    };

    const exportExcel = () => {
        const rows = buildExportRows();
        if (rows.length === 0) {
            toast.error('Tidak ada data untuk diekspor.');
            return;
        }

        const header = ['No', 'Kode', 'Nama Layanan', 'Kategori', 'Harga', 'Durasi (menit)', 'Kompleksitas', 'Status', 'Deskripsi'];
        const tableRows = rows
            .map((row) => [
                row.no,
                row.code,
                row.name,
                row.category,
                row.price,
                row.duration,
                row.complexity,
                row.status,
                row.description,
            ])
            .map((line) => `<tr>${line.map((cell) => `<td>${String(cell).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`)
            .join('');

        const html = `
<table>
    <thead><tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
</table>`;

        downloadFile(`services-export-${new Date().toISOString().slice(0, 10)}.xls`, html, 'application/vnd.ms-excel;charset=utf-8;');
        toast.success('Export Excel berhasil dibuat.');
    };

    const submitQuickCreate = (e) => {
        e.preventDefault();

        postQuickService(route('services.store'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Layanan berhasil ditambahkan.');
                setShowQuickCreate(false);
                resetQuickForm();
            },
            onError: () => {
                toast.error('Gagal menambahkan layanan. Cek input wajib.');
            },
        });
    };

    return (
        <>
            <Head title="Daftar Layanan" />

            <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 mb-6 bg-gradient-to-br from-white via-primary-50/40 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 md:p-7">
                <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-primary-300/20 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-success-300/20 blur-2xl" />

                <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">Workshop Service Catalog</p>
                        <h1 className="mt-2 text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Daftar Layanan Bengkel</h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Kelola paket servis dengan filter cepat, bulk action, export, dan quick create.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="Grid View"
                            >
                                <IconLayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="List View"
                            >
                                <IconList size={18} />
                            </button>
                        </div>
                        <Search route={route('services.index')} />
                        <button
                            type="button"
                            onClick={() => setShowQuickCreate(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                        >
                            <IconCirclePlus size={18} />
                            Quick Create
                        </button>
                        <Link
                            href={route('service-categories.index')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-semibold"
                        >
                            <IconCategory2 size={18} />
                            Kategori Layanan
                        </Link>
                        <Button type="link" href={route('services.create')} icon={<IconCirclePlus size={18} />} label="Tambah Layanan" />
                    </div>
                </div>

                <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard title="Total Layanan" value={computedSummary.total} icon={<IconCategory size={20} />} tone="primary" />
                    <StatCard title="Status Aktif" value={computedSummary.active} icon={<IconChecks size={20} />} tone="success" />
                    <StatCard title="Status Nonaktif" value={computedSummary.inactive} icon={<IconX size={20} />} tone="slate" />
                    <StatCard title="Rata-rata Harga" value={formatCurrency(computedSummary.avgPrice)} icon={<IconCurrencyDollar size={20} />} tone="warning" />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-6">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <IconAdjustmentsHorizontal size={18} />
                        <p className="text-sm font-semibold">Filter Cepat & Sorting</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={exportCsv} type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <IconDownload size={16} /> CSV
                        </button>
                        <button onClick={exportExcel} type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <IconDownload size={16} /> Excel
                        </button>
                        <div className="relative w-full xl:w-80">
                            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={quickSearch}
                                onChange={(e) => setQuickSearch(e.target.value)}
                                type="text"
                                placeholder="Cari nama, deskripsi, kategori, kode..."
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                        <option value="all">Semua Status</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                    </select>

                    <select value={complexityFilter} onChange={(e) => setComplexityFilter(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                        <option value="all">Semua Kompleksitas</option>
                        <option value="simple">Sederhana</option>
                        <option value="medium">Menengah</option>
                        <option value="complex">Kompleks</option>
                    </select>

                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                        <option value="all">Semua Kategori</option>
                        {categoryOptions.map((category) => (
                            <option key={category.id} value={String(category.id)}>{category.name}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <IconArrowsSort size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                                {sortOptions.map((option) => (
                                    <option key={option.key} value={option.key}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 font-semibold">
                        <IconBolt size={14} />
                        Menampilkan {filteredServices.length} dari {liveServices.length} layanan
                    </span>
                    {hasFilter && <span className="font-medium text-primary-600 dark:text-primary-400">Filter aktif</span>}
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleSelectAllVisible}
                                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            Pilih semua hasil filter
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{selectedIds.length} terpilih</span>
                            <button type="button" onClick={() => runBulkStatus('active')} className="rounded-lg bg-success-600 hover:bg-success-700 text-white px-3 py-2 text-xs font-semibold">Set Aktif</button>
                            <button type="button" onClick={() => runBulkStatus('inactive')} className="rounded-lg bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 text-xs font-semibold">Set Nonaktif</button>
                            <button type="button" onClick={runBulkDelete} className="rounded-lg bg-danger-600 hover:bg-danger-700 text-white px-3 py-2 text-xs font-semibold">Hapus Terpilih</button>
                        </div>
                    </div>
                </div>
            </div>

            {filteredServices.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredServices.map((service) => (
                                    <ServiceCard
                                        key={service.id}
                                        service={service}
                                        checked={selectedIds.includes(service.id)}
                                        onToggle={toggleSelect}
                                        isHighlighted={false}
                                    />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            <th className="px-4 py-4 text-left"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" /></th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Layanan</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Harga</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Durasi</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kompleksitas</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredServices.map((service, idx) => {
                                            const complexity = complexityBadge[service.complexity_level] || complexityBadge.simple;
                                            const status = statusBadge[service.status] || statusBadge.active;

                                            return (
                                                <tr key={service.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(service.id)}
                                                            onChange={() => toggleSelect(service.id)}
                                                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1}</td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{service.name}</div>
                                                        {service.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{service.description}</div>}
                                                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Kode: {service.code || `SVC-${service.id}`}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-full">
                                                            <span>{service.category?.icon || 'ðŸ”§'}</span>
                                                            <span>{service.category?.name || '-'}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(service.price)}</td>
                                                    <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-400">{service.duration} menit</td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${complexity.class}`}>
                                                            {complexity.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status.class}`}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Link href={route('services.edit', service.id)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-warning-700 bg-warning-50 hover:bg-warning-100 dark:bg-warning-900/30 dark:text-warning-300 dark:hover:bg-warning-900/50 transition-colors">
                                                                <IconPencilCog size={14} className="mr-1" /> Edit
                                                            </Link>
                                                            <Button type="delete" icon={<IconTrash size={14} />} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50" url={route('services.destroy', service.id)} label="Hapus" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <IconDatabaseOff size={32} className="text-slate-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">Data Tidak Ditemukan</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Coba ubah filter atau tambahkan layanan baru.</p>
                    {liveServices.length === 0 ? (
                        <Button type="link" href={route('services.create')} icon={<IconCirclePlus size={18} />} label="Tambah Layanan Pertama" />
                    ) : (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
                        >
                            Reset Filter
                        </button>
                    )}
                </div>
            )}

            {services.last_page > 1 && <Pagination links={services.links} />}

            <Modal title="Quick Create Layanan" show={showQuickCreate} maxWidth="lg" onClose={() => setShowQuickCreate(false)}>
                <form onSubmit={submitQuickCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori *</label>
                            <select
                                value={quickData.service_category_id}
                                onChange={(e) => setQuickData('service_category_id', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
                            >
                                <option value="">Pilih kategori</option>
                                {categoryOptions.map((category) => (
                                    <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
                                ))}
                            </select>
                            {quickErrors.service_category_id && <p className="text-xs text-danger-600 mt-1">{quickErrors.service_category_id}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Layanan *</label>
                            <input
                                value={quickData.name}
                                onChange={(e) => setQuickData('name', e.target.value)}
                                type="text"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
                                placeholder="Contoh: Ganti Oli"
                            />
                            {quickErrors.name && <p className="text-xs text-danger-600 mt-1">{quickErrors.name}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Deskripsi</label>
                        <textarea
                            value={quickData.description}
                            onChange={(e) => setQuickData('description', e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Harga *</label>
                            <input
                                value={quickData.price}
                                onChange={(e) => setQuickData('price', e.target.value)}
                                type="number"
                                min="0"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
                            />
                            {quickErrors.price && <p className="text-xs text-danger-600 mt-1">{quickErrors.price}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Durasi *</label>
                            <input
                                value={quickData.duration}
                                onChange={(e) => setQuickData('duration', e.target.value)}
                                type="number"
                                min="1"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
                            />
                            {quickErrors.duration && <p className="text-xs text-danger-600 mt-1">{quickErrors.duration}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Kompleksitas *</label>
                            <select value={quickData.complexity_level} onChange={(e) => setQuickData('complexity_level', e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                                <option value="simple">Sederhana</option>
                                <option value="medium">Menengah</option>
                                <option value="complex">Kompleks</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Status *</label>
                            <select value={quickData.status} onChange={(e) => setQuickData('status', e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                                <option value="active">Aktif</option>
                                <option value="inactive">Nonaktif</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowQuickCreate(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Batal</button>
                        <button type="submit" disabled={quickProcessing} className="rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold">
                            {quickProcessing ? 'Menyimpan...' : 'Simpan Layanan'}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

export default Index;


