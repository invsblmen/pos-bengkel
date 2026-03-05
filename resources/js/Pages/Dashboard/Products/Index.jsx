import React, { useState, useEffect } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, usePage, Link } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconCirclePlus,
    IconDatabaseOff,
    IconPencilCog,
    IconTrash,
    IconLayoutGrid,
    IconList,
    IconPhoto,
    IconPackage,
    IconSearch,
} from "@tabler/icons-react";
import Search from "@/Components/Dashboard/Search";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { getProductImageUrl } from "@/Utils/imageUrl";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

// Product Card for Grid View
function ProductCard({ product, index, currentPage, perPage }) {
    const rowNumber = index + 1 + (currentPage - 1) * perPage;
    const lowStock = product.stock > 0 && product.stock <= 5;
    const outOfStock = product.stock === 0;

    return (
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200">
            {/* Product Image */}
            <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {product.image ? (
                    <img
                        src={getProductImageUrl(product.image)}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <IconPhoto
                            size={48}
                            className="text-slate-300 dark:text-slate-600"
                            strokeWidth={1}
                        />
                    </div>
                )}

                {/* Stock Badge */}
                <div className="absolute top-2 right-2">
                    {outOfStock ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-danger-500 text-white rounded-full">
                            Habis
                        </span>
                    ) : lowStock ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-warning-500 text-white rounded-full">
                            Stok: {product.stock}
                        </span>
                    ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-slate-900/60 text-white rounded-full">
                            Stok: {product.stock}
                        </span>
                    )}
                </div>

                {/* Action Buttons Overlay */}
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Link
                        href={route("products.edit", product.id)}
                        className="p-2.5 rounded-xl bg-white text-warning-600 hover:bg-warning-50 shadow-lg transition-colors"
                    >
                        <IconPencilCog size={18} />
                    </Link>
                    <Button
                        type={"delete"}
                        icon={<IconTrash size={18} />}
                        className={
                            "p-2.5 rounded-xl bg-white text-danger-600 hover:bg-danger-50 shadow-lg"
                        }
                        url={route("products.destroy", product.id)}
                    />
                </div>
            </div>

            {/* Product Info */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-md">
                        {product.category?.name || "Kategori"}
                    </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 mb-1">
                    {product.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-3">
                    {product.barcode}
                </p>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Harga Beli
                        </p>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {formatCurrency(product.buy_price)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Harga Jual
                        </p>
                        <p className="text-base font-bold text-primary-600 dark:text-primary-400">
                            {formatCurrency(product.sell_price)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Index({ products }) {
    const { roles, permissions, errors } = usePage().props;
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
    const [liveProducts, setLiveProducts] = useState(products?.data || []);

    // Real-time listener for products
    useEffect(() => {
        if (!window.Echo) {
            console.warn('Echo not available - real-time updates disabled');
            return;
        }

        const channel = window.Echo.channel('workshop.products');

        channel.listen('.product.created', (event) => {
            console.log('Product created event received:', event);
            const incomingProduct = event?.product;

            if (!incomingProduct?.id) {
                console.warn('Invalid product data received');
                return;
            }

            setLiveProducts(prev => {
                const exists = prev.some(p => p.id === incomingProduct.id);
                if (exists) {
                    console.log('Product already in list, skipping');
                    return prev;
                }
                console.log('Adding new product:', incomingProduct.title);
                return [incomingProduct, ...prev];
            });
        });

        channel.listen('.product.deleted', (event) => {
            console.log('Product deleted event received:', event);
            const deletedProductId = event?.productId;

            if (!deletedProductId) {
                console.warn('Invalid product ID received');
                return;
            }

            setLiveProducts(prev => {
                const filtered = prev.filter(p => p.id !== deletedProductId);
                console.log('Removed product with ID:', deletedProductId);
                return filtered;
            });
        });

        channel.listen('.product.updated', (event) => {
            console.log('Product updated event received:', event);
            const updatedProduct = event?.product;

            if (!updatedProduct?.id) {
                console.warn('Invalid product data received');
                return;
            }

            setLiveProducts(prev => {
                const index = prev.findIndex(p => p.id === updatedProduct.id);
                if (index === -1) {
                    console.log('Product not found in list, skipping update');
                    return prev;
                }
                const updated = [...prev];
                updated[index] = updatedProduct;
                console.log('Updated product:', updatedProduct.title);
                return updated;
            });
        });

        return () => {
            window.Echo.leaveChannel('workshop.products');
        };
    }, []);

    return (
        <>
            <Head title="Produk" />

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Produk
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {liveProducts?.length || 0} produk terdaftar
                        </p>
                    </div>
                    <Button
                        type={"link"}
                        icon={<IconCirclePlus size={18} strokeWidth={1.5} />}
                        className={
                            "bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                        }
                        label={"Tambah Produk"}
                        href={route("products.create")}
                    />
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="w-full sm:w-80">
                    <Search
                        url={route("products.index")}
                        placeholder="Cari produk..."
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2.5 rounded-lg transition-colors ${
                            viewMode === "grid"
                                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title="Grid View"
                    >
                        <IconLayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`p-2.5 rounded-lg transition-colors ${
                            viewMode === "list"
                                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title="List View"
                    >
                        <IconList size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {liveProducts.length > 0 ? (
                viewMode === "grid" ? (
                    /* Grid View */
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {liveProducts.map((product, i) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={i}
                                currentPage={products.current_page}
                                perPage={products.per_page}
                            />
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <Table.Card title={"Data Produk"}>
                        <Table>
                            <Table.Thead>
                                <tr>
                                    <Table.Th className="w-10">No</Table.Th>
                                    <Table.Th>Produk</Table.Th>
                                    <Table.Th>Kategori</Table.Th>
                                    <Table.Th>Harga Beli</Table.Th>
                                    <Table.Th>Harga Jual</Table.Th>
                                    <Table.Th>Stok</Table.Th>
                                    <Table.Th></Table.Th>
                                </tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {liveProducts.map((product, i) => (
                                    <tr
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        key={product.id}
                                    >
                                        <Table.Td className="text-center">
                                            {++i +
                                                (products.current_page - 1) *
                                                    products.per_page}
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                                                    {product.image ? (
                                                        <img
                                                            src={`/storage/products/${product.image}`}
                                                            alt={product.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <IconPackage
                                                                size={16}
                                                                className="text-slate-400"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                        {product.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {product.barcode}
                                                    </p>
                                                </div>
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                                                {product.category?.name}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            {formatCurrency(product.buy_price)}
                                        </Table.Td>
                                        <Table.Td className="font-semibold text-primary-600 dark:text-primary-400">
                                            {formatCurrency(product.sell_price)}
                                        </Table.Td>
                                        <Table.Td>
                                            <span
                                                className={`px-2 py-0.5 text-xs font-medium rounded ${
                                                    product.stock === 0
                                                        ? "bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-400"
                                                        : product.stock <= 5
                                                        ? "bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400"
                                                        : "bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-400"
                                                }`}
                                            >
                                                {product.stock}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex gap-2">
                                                <Button
                                                    type={"edit"}
                                                    icon={
                                                        <IconPencilCog
                                                            size={16}
                                                            strokeWidth={1.5}
                                                        />
                                                    }
                                                    className={
                                                        "border bg-warning-100 border-warning-200 text-warning-600 hover:bg-warning-200 dark:bg-warning-900/50 dark:border-warning-800 dark:text-warning-400"
                                                    }
                                                    href={route(
                                                        "products.edit",
                                                        product.id
                                                    )}
                                                />
                                                <Button
                                                    type={"delete"}
                                                    icon={
                                                        <IconTrash
                                                            size={16}
                                                            strokeWidth={1.5}
                                                        />
                                                    }
                                                    className={
                                                        "border bg-danger-100 border-danger-200 text-danger-600 hover:bg-danger-200 dark:bg-danger-900/50 dark:border-danger-800 dark:text-danger-400"
                                                    }
                                                    url={route(
                                                        "products.destroy",
                                                        product.id
                                                    )}
                                                />
                                            </div>
                                        </Table.Td>
                                    </tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.Card>
                )
            ) : (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <IconDatabaseOff
                            size={32}
                            className="text-slate-400"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Belum Ada Produk
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Tambahkan produk pertama Anda untuk memulai.
                    </p>
                    <Button
                        type={"link"}
                        icon={<IconCirclePlus size={18} />}
                        className={
                            "bg-primary-500 hover:bg-primary-600 text-white"
                        }
                        label={"Tambah Produk"}
                        href={route("products.create")}
                    />
                </div>
            )}

            {products.last_page !== 1 && <Pagination links={products.links} />}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
