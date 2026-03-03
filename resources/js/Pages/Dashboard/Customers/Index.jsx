import React, { useState, useEffect } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, usePage, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import { useVisibilityRealtime } from "@/Hooks/useRealtime";
import {
    IconCirclePlus,
    IconDatabaseOff,
    IconPencilCog,
    IconTrash,
    IconLayoutGrid,
    IconList,
    IconUser,
    IconPhone,
    IconMapPin,
    IconMail,
    IconCar,
    IconDots,
    IconX,
} from "@tabler/icons-react";
import Search from "@/Components/Dashboard/Search";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";

// Customer Card for Grid View
function CustomerCard({ customer }) {
    return (
        <div className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
            {/* Gradient Background Decoration */}
            <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-primary-100/50 to-accent-100/50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-full blur-2xl -z-10 group-hover:scale-105 transition-transform duration-300"></div>

            {/* User Info Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 via-accent-400 to-accent-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-primary-500/20">
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success-500 border-2 border-white dark:border-slate-900 flex items-center justify-center"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {customer.name}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Contact Info - Condensed */}
            {(customer.phone || customer.email || customer.address) && (
                <div className="space-y-2.5 mb-4">
                    {customer.phone && (
                        <div className="flex items-center gap-2.5 min-w-0 group/item">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 group-hover/item:bg-blue-200 dark:group-hover/item:bg-blue-900/50 transition-colors">
                                <IconPhone size={15} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">{customer.phone}</span>
                        </div>
                    )}
                    {customer.email && (
                        <div className="flex items-center gap-2.5 min-w-0 group/item">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 group-hover/item:bg-purple-200 dark:group-hover/item:bg-purple-900/50 transition-colors">
                                <IconMail size={15} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">{customer.email}</span>
                        </div>
                    )}
                    {customer.address && (
                        <div className="flex items-start gap-2.5 min-w-0 group/item">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 group-hover/item:bg-orange-200 dark:group-hover/item:bg-orange-900/50 transition-colors">
                                <IconMapPin size={15} className="text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 font-medium leading-snug">{customer.address}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Vehicles Badge - Compact */}
            {customer.vehicles && customer.vehicles.length > 0 && (
                <div className="mb-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary-100 to-accent-100 dark:from-primary-900/40 dark:to-accent-900/40 border border-primary-200 dark:border-primary-800/50">
                        <IconCar size={15} className="text-primary-600 dark:text-primary-400 flex-shrink-0" />
                        <span className="text-xs font-bold text-primary-900 dark:text-primary-300">
                            {customer.vehicles.length} Kendaraan
                        </span>
                    </div>
                    <div className="mt-2 space-y-1">
                        {customer.vehicles.slice(0, 1).map((vehicle) => (
                            <div key={vehicle.id} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-primary-400 dark:bg-primary-500 flex-shrink-0"></span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{vehicle.plate_number}</span>
                            </div>
                        ))}
                        {customer.vehicles.length > 1 && (
                            <div className="text-xs text-primary-600 dark:text-primary-400 font-bold">
                                +{customer.vehicles.length - 1} lainnya
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-3.5 border-t border-slate-100 dark:border-slate-700">
                <Link
                    href={route("customers.edit", customer.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-600 dark:text-blue-400 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/50 font-semibold transition-all duration-200 hover:shadow-md text-xs"
                >
                    <IconPencilCog size={14} />
                    <span>Edit</span>
                </Link>
                <Button
                    type={"delete"}
                    icon={<IconTrash size={14} />}
                    className={
                        "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 text-red-600 dark:text-red-400 hover:from-red-100 hover:to-rose-100 dark:hover:from-red-900/50 dark:hover:to-rose-900/50 font-semibold transition-all duration-200 hover:shadow-md text-xs"
                    }
                    url={route("customers.destroy", customer.id)}
                    label="Hapus"
                />
            </div>
        </div>
    );
}

export default function Index({ customers }) {
    const { roles, permissions, errors, url } = usePage().props;
    const [viewMode, setViewMode] = useState("grid");
    const [perPage, setPerPage] = useState(customers.per_page || 12);

    // Check if there's an active filter/search
    const hasActiveFilter = new URLSearchParams(window.location.search).has('search');

    // Sync perPage state with customers data
    useEffect(() => {
        if (customers.per_page) {
            setPerPage(customers.per_page);
        }
    }, [customers.per_page]);

    // Enable real-time updates
    useVisibilityRealtime({
        interval: 5000,
        only: ['customers'],
        preserveScroll: true,
        preserveState: true
    });

    const handlePerPageChange = (newPerPage) => {
        setPerPage(newPerPage);
        router.get(route('customers.index'), { per_page: newPerPage }, {
            preserveScroll: true,
            preserveState: true
        });
    };

    const handleClearFilter = () => {
        router.get(route('customers.index'), {}, {
            preserveScroll: true,
            preserveState: false
        });
    };

    return (
        <>
            <Head title="Pelanggan" />

            {/* Header */}
            <div className="mb-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                                <IconUser size={24} className="text-white" strokeWidth={1.5} />
                            </div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white bg-gradient-to-r from-primary-600 to-accent-600 dark:from-primary-400 dark:to-accent-400 bg-clip-text text-transparent">
                                Manajemen Pelanggan
                            </h1>
                        </div>
                        <p className="text-base text-slate-600 dark:text-slate-400 ml-15">
                            Total <span className="font-bold text-slate-900 dark:text-slate-200 bg-primary-100 dark:bg-primary-900/30 px-2.5 py-1 rounded-lg">{customers.total || customers.data?.length || 0}</span> pelanggan terdaftar di sistem
                        </p>
                    </div>
                    <Button
                        type={"link"}
                        icon={<IconCirclePlus size={20} strokeWidth={1.5} />}
                        className={
                            "bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white shadow-lg shadow-primary-500/40 font-bold px-6 py-3 rounded-xl"
                        }
                        label={"Tambah Pelanggan"}
                        href={route("customers.create")}
                    />
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-gradient-to-r from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4">
                <div className="flex-1 flex items-center gap-3">
                    <div className="w-full sm:w-96">
                        <Search
                            url={route("customers.index")}
                            placeholder="🔍 Cari nama, telepon, atau email..."
                        />
                    </div>
                    {/* Clear Filter Button */}
                    {hasActiveFilter && (
                        <button
                            onClick={handleClearFilter}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 border border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:from-red-200 hover:to-rose-200 dark:hover:from-red-900/50 dark:hover:to-rose-900/50 font-semibold transition-all duration-200 hover:shadow-md whitespace-nowrap"
                            title="Hapus Filter"
                        >
                            <IconX size={18} />
                            <span className="text-sm hidden sm:inline">Hapus Filter</span>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {/* Per Page Select */}
                    {viewMode === "grid" && (
                        <select
                            value={perPage}
                            onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                            className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold shadow-sm hover:shadow-md hover:border-primary-400 dark:hover:border-primary-600 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                            title="Jumlah per halaman"
                        >
                            <option value="8">8 per halaman</option>
                            <option value="12">12 per halaman</option>
                            <option value="16">16 per halaman</option>
                            <option value="20">20 per halaman</option>
                            <option value="24">24 per halaman</option>
                        </select>
                    )}

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-1.5 shadow-sm">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`px-3.5 py-2 rounded-lg transition-all duration-200 font-semibold flex items-center gap-1.5 ${
                                viewMode === "grid"
                                    ? "bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-md"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            }`}
                            title="Grid View"
                        >
                            <IconLayoutGrid size={20} />
                            <span className="text-sm hidden sm:inline">Grid</span>
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`px-3.5 py-2 rounded-lg transition-all duration-200 font-semibold flex items-center gap-1.5 ${
                                viewMode === "list"
                                    ? "bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-md"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            }`}
                            title="List View"
                        >
                            <IconList size={20} />
                            <span className="text-sm hidden sm:inline">List</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {customers.data.length > 0 ? (
                viewMode === "grid" ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {customers.data.map((customer) => (
                            <CustomerCard
                                key={customer.id}
                                customer={customer}
                            />
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <Table.Card title={"Data Pelanggan"}>
                        <div className="overflow-x-auto">
                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th className="w-12">No</Table.Th>
                                        <Table.Th>Nama Pelanggan</Table.Th>
                                        <Table.Th className="hidden md:table-cell">Telepon</Table.Th>
                                        <Table.Th className="hidden lg:table-cell">Email</Table.Th>
                                        <Table.Th className="hidden sm:table-cell text-center">Kendaraan</Table.Th>
                                        <Table.Th className="w-20 text-center">Aksi</Table.Th>
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {customers.data.map((customer, i) => (
                                        <tr
                                            className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            key={customer.id}
                                        >
                                            <Table.Td className="text-center text-sm text-slate-500">
                                                {++i + (customers.current_page - 1) * customers.per_page}
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-3 py-2">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                                        {customer.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                                                            {customer.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 md:hidden">
                                                            {customer.phone || "No phone"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Table.Td>
                                            <Table.Td className="hidden md:table-cell">
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                                    {customer.phone || "-"}
                                                </span>
                                            </Table.Td>
                                            <Table.Td className="hidden lg:table-cell">
                                                <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-xs block">
                                                    {customer.email || "-"}
                                                </span>
                                            </Table.Td>
                                            <Table.Td className="hidden sm:table-cell">
                                                <div className="flex items-center justify-center">
                                                    {customer.vehicles && customer.vehicles.length > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold">
                                                            <IconCar size={14} />
                                                            {customer.vehicles.length}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Link
                                                        href={route("customers.edit", customer.id)}
                                                        className="inline-flex items-center justify-center p-2 rounded-lg text-warning-600 hover:bg-warning-100 dark:text-warning-400 dark:hover:bg-warning-900/30 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <IconPencilCog size={16} />
                                                    </Link>
                                                    <Button
                                                        type={"delete"}
                                                        icon={<IconTrash size={16} />}
                                                        className={
                                                            "p-2 rounded-lg text-danger-600 hover:bg-danger-100 dark:text-danger-400 dark:hover:bg-danger-900/30"
                                                        }
                                                        url={route("customers.destroy", customer.id)}
                                                    />
                                                </div>
                                            </Table.Td>
                                        </tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </div>
                    </Table.Card>
                )
            ) : (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-24 px-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-6 shadow-lg">
                        <IconDatabaseOff
                            size={40}
                            className="text-slate-400 dark:text-slate-500"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3 text-center">
                        Belum Ada Data Pelanggan
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-center max-w-md mb-8 leading-relaxed">
                        Mulai dengan menambahkan pelanggan pertama Anda untuk melacak data, kendaraan, dan riwayat layanan mereka.
                    </p>
                    <Button
                        type={"link"}
                        icon={<IconCirclePlus size={20} />}
                        className={
                            "bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white shadow-lg shadow-primary-500/40 font-bold px-6 py-3 rounded-xl"
                        }
                        label={"Tambah Pelanggan Pertama"}
                        href={route("customers.create")}
                    />
                </div>
            )}

            {customers.last_page !== 1 && (
                <Pagination links={customers.links} />
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
