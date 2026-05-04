import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';
import Pagination from '@/Components/Dashboard/Pagination';
import {
    IconCirclePlus,
    IconPencilCog,
    IconTrash,
    IconDatabaseOff,
    IconLayoutGrid,
    IconList,
    IconSettings,
    IconAdjustmentsHorizontal,
    IconBolt,
    IconCategory,
    IconSearch,
    IconArrowsSort,
    IconArrowLeft,
} from '@tabler/icons-react';

const sortOptions = [
    { key: 'latest', label: 'Terbaru' },
    { key: 'name-asc', label: 'Nama A-Z' },
    { key: 'name-desc', label: 'Nama Z-A' },
    { key: 'order-asc', label: 'Urutan Terkecil' },
    { key: 'order-desc', label: 'Urutan Terbesar' },
];

function StatCard({ title, value, icon, tone = 'primary' }) {
    const tones = {
        primary: 'from-primary-500/15 to-primary-500/5 text-primary-700 dark:text-primary-300 border-primary-200/60 dark:border-primary-800/70',
        success: 'from-success-500/15 to-success-500/5 text-success-700 dark:text-success-300 border-success-200/60 dark:border-success-800/70',
        warning: 'from-warning-500/15 to-warning-500/5 text-warning-700 dark:text-warning-300 border-warning-200/60 dark:border-warning-800/70',
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

function CategoryCard({ category, isHighlighted }) {
    return (
        <div className={`group rounded-2xl border overflow-hidden hover:shadow-lg hover:shadow-primary-500/10 transition-all duration-200 ${isHighlighted ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
            <div className="p-4 bg-gradient-to-br from-primary-50 to-slate-50 dark:from-primary-900/20 dark:to-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center h-32">
                <span className="text-6xl">{category.icon || 'ðŸ”§'}</span>
            </div>
            <div className="p-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1 line-clamp-2">{category.name}</h3>
                {category.description && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{category.description}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mb-3">
                    <span className="text-xs text-slate-400 dark:text-slate-500">Urutan</span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                        {category.sort_order || 0}
                    </span>
                </div>
                <div className="flex gap-2">
                    <Link href={route('service-categories.edit', category.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-warning-100 text-warning-600 hover:bg-warning-200 dark:bg-warning-900/50 dark:text-warning-400 text-sm font-medium transition-colors">
                        <IconPencilCog size={16} /> <span>Edit</span>
                    </Link>
                    <Button type="delete" icon={<IconTrash size={16} />} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-danger-100 text-danger-600 hover:bg-danger-200 dark:bg-danger-900/50 dark:text-danger-400 text-sm font-medium" url={route('service-categories.destroy', category.id)} label="Hapus" />
                </div>
            </div>
        </div>
    );
}

function Index({ categories }) {
    const [viewMode, setViewMode] = useState('grid');
    const [liveServiceCategories, setLiveServiceCategories] = useState(categories?.data || []);
    const [quickSearch, setQuickSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');

    const summary = useMemo(() => {
        const total = liveServiceCategories.length;
        const withDescription = liveServiceCategories.filter((item) => item.description && item.description.trim().length > 0).length;
        const highestSort = total ? Math.max(...liveServiceCategories.map((item) => Number(item.sort_order) || 0)) : 0;
        return { total, withDescription, highestSort };
    }, [liveServiceCategories]);

    const filteredCategories = useMemo(() => {
        const normalizedSearch = quickSearch.trim().toLowerCase();
        let collection = [...liveServiceCategories];

        if (normalizedSearch) {
            collection = collection.filter((item) => {
                const haystack = [item.name, item.description, item.icon]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(normalizedSearch);
            });
        }

        collection.sort((a, b) => {
            if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
            if (sortBy === 'order-asc') return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
            if (sortBy === 'order-desc') return (Number(b.sort_order) || 0) - (Number(a.sort_order) || 0);
            return (new Date(b.updated_at || b.created_at || 0)).getTime() - (new Date(a.updated_at || a.created_at || 0)).getTime();
        });

        return collection;
    }, [liveServiceCategories, quickSearch, sortBy]);

    const clearFilters = () => {
        setQuickSearch('');
        setSortBy('latest');
    };

    const hasFilter = quickSearch || sortBy !== 'latest';

    return (
        <>
            <Head title="Kategori Layanan Servis" />

            <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 mb-6 bg-gradient-to-br from-white via-primary-50/40 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 md:p-7">
                <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-primary-300/20 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-warning-300/20 blur-2xl" />

                <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">Service Category Management</p>
                        <h1 className="mt-2 text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Kategori Layanan Servis</h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Kelola struktur kategori layanan agar input servis lebih cepat, rapi, dan konsisten.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route('services.index')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Back to Daftar Layanan
                        </Link>
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
                        <Search route={route('service-categories.index')} />
                        <Button type="link" href={route('service-categories.create')} icon={<IconCirclePlus size={18} />} label="Tambah Kategori" />
                    </div>
                </div>

                <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <StatCard title="Total Kategori" value={summary.total} icon={<IconCategory size={20} />} tone="primary" />
                    <StatCard title="Punya Deskripsi" value={summary.withDescription} icon={<IconBolt size={20} />} tone="success" />
                    <StatCard title="Urutan Tertinggi" value={summary.highestSort} icon={<IconSettings size={20} />} tone="warning" />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-6">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <IconAdjustmentsHorizontal size={18} />
                        <p className="text-sm font-semibold">Filter Cepat & Sorting</p>
                    </div>
                    <div className="relative w-full xl:w-80">
                        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={quickSearch}
                            onChange={(e) => setQuickSearch(e.target.value)}
                            type="text"
                            placeholder="Cari nama, deskripsi, icon..."
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                        <IconArrowsSort size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
                        >
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
                        Reset Filter
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 font-semibold">
                        <IconBolt size={14} />
                        Menampilkan {filteredCategories.length} dari {liveServiceCategories.length} kategori
                    </span>
                    {hasFilter && <span className="font-medium text-primary-600 dark:text-primary-400">Filter aktif</span>}
                </div>
            </div>

            {filteredCategories.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredCategories.map((category) => (
                                <CategoryCard key={category.id} category={category} isHighlighted={false} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Icon</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Kategori</th>
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deskripsi</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Urutan</th>
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredCategories.map((category, idx) => (
                                            <tr key={category.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1}</td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-3xl">{category.icon || 'ðŸ”§'}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{category.name}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">{category.description || '-'}</div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {category.sort_order || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Link href={route('service-categories.edit', category.id)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-warning-700 bg-warning-50 hover:bg-warning-100 dark:bg-warning-900/30 dark:text-warning-300 dark:hover:bg-warning-900/50 transition-colors">
                                                            <IconPencilCog size={14} className="mr-1" /> Edit
                                                        </Link>
                                                        <Button type="delete" icon={<IconTrash size={14} />} className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-danger-700 bg-danger-50 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50" url={route('service-categories.destroy', category.id)} label="Hapus" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
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
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Coba ubah filter atau tambahkan kategori baru.</p>
                    {liveServiceCategories.length === 0 ? (
                        <Button type="link" href={route('service-categories.create')} icon={<IconCirclePlus size={18} />} label="Tambah Kategori Pertama" />
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

            {categories.last_page > 1 && <Pagination links={categories.links} />}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

export default Index;


