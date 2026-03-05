import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';
import Pagination from '@/Components/Dashboard/Pagination';
import {
    IconCirclePlus, IconPencilCog, IconTrash, IconDatabaseOff,
    IconLayoutGrid, IconList, IconSettings
} from '@tabler/icons-react';

// Category Card for Grid View
function CategoryCard({ category }) {
    return (
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            <div className="p-4 bg-gradient-to-br from-primary-50 to-slate-50 dark:from-primary-900/20 dark:to-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center h-32">
                <span className="text-6xl">{category.icon || '🔧'}</span>
            </div>
            <div className="p-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">{category.name}</h3>
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

    // Real-time listener for service categories
    useEffect(() => {
        if (!window.Echo) {
            console.warn('Echo not available - real-time updates disabled');
            return;
        }

        const channel = window.Echo.channel('workshop.servicecategories');

        channel.listen('.servicecategory.created', (event) => {
            console.log('Service category created event received:', event);
            const incomingCategory = event?.category;

            if (!incomingCategory?.id) {
                console.warn('Invalid service category data received');
                return;
            }

            setLiveServiceCategories(prev => {
                const exists = prev.some(c => c.id === incomingCategory.id);
                if (exists) {
                    console.log('Service category already in list, skipping');
                    return prev;
                }
                console.log('Adding new service category:', incomingCategory.name);
                return [incomingCategory, ...prev];
            });
        });

        channel.listen('.servicecategory.deleted', (event) => {
            console.log('Service category deleted event received:', event);
            const deletedCategoryId = event?.categoryId;

            if (!deletedCategoryId) {
                console.warn('Invalid service category ID received');
                return;
            }

            setLiveServiceCategories(prev => {
                const filtered = prev.filter(c => c.id !== deletedCategoryId);
                console.log('Removed service category with ID:', deletedCategoryId);
                return filtered;
            });
        });

        channel.listen('.servicecategory.updated', (event) => {
            console.log('Service category updated event received:', event);
            const updatedCategory = event?.category;

            if (!updatedCategory?.id) {
                console.warn('Invalid service category data received');
                return;
            }

            setLiveServiceCategories(prev => {
                const index = prev.findIndex(c => c.id === updatedCategory.id);
                if (index === -1) {
                    console.log('Service category not found in list, skipping update');
                    return prev;
                }
                const updated = [...prev];
                updated[index] = updatedCategory;
                console.log('Updated service category:', updatedCategory.name);
                return updated;
            });
        });

        return () => {
            window.Echo.leaveChannel('workshop.servicecategories');
        };
    }, []);

    return (
        <>
            <Head title="Kategori Layanan Servis" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Kategori Layanan Servis</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{liveServiceCategories?.length || 0} kategori tersedia</p>
                    </div>
                    <div className="flex items-center gap-2">
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

                {liveServiceCategories && liveServiceCategories.length > 0 ? (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {liveServiceCategories.map((category) => (
                                    <CategoryCard key={category.id} category={category} />
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
                                            {liveServiceCategories.map((category, idx) => (
                                                <tr key={category.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className="text-3xl">{category.icon || '🔧'}</span>
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
                        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">Belum Ada Kategori</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Kategori layanan akan muncul di sini setelah dibuat.</p>
                        <Button type="link" href={route('service-categories.create')} icon={<IconCirclePlus size={18} />} label="Tambah Kategori Pertama" />
                    </div>
                )}

            {categories.last_page > 1 && <Pagination links={categories.links} />}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

export default Index;
