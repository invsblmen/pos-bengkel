import React, { useEffect, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import axios from 'axios';
import Modal from '@/Components/Dashboard/Modal';

export default function SDMSPkb({ sdms }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchPkb = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/reception/Pkb');
            const d = res.data;
            let list = [];
            if (Array.isArray(d)) {
                list = d;
            } else if (d && Array.isArray(d.Result)) {
                list = d.Result;
            } else if (d && Array.isArray(d.result)) {
                list = d.result;
            } else if (d && Array.isArray(d.data)) {
                list = d.data;
            } else if (d && Array.isArray(d.Data)) {
                list = d.Data;
            } else if (d && d.Result && Array.isArray(d.Result.Result)) {
                list = d.Result.Result;
            }

            setItems(list || []);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        if (mounted) fetchPkb();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <DashboardLayout>
            <Head title="List PKB" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">List PKB</h1>
                    <p className="text-gray-600">Daftar PKB dari SDMS Dealer API.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>PKB</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <button onClick={fetchPkb} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
                                    {loading ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <p className="text-sm text-gray-600">Memuat...</p>
                        ) : error ? (
                            <div className="text-sm text-red-600">{error}</div>
                        ) : items.length === 0 ? (
                            <p className="text-sm text-gray-600">Tidak ada PKB ditemukan.</p>
                        ) : (
                            <div className="overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-3 py-2">No PKB</th>
                                            <th className="px-3 py-2">Customer</th>
                                            <th className="px-3 py-2">Vehicle</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-3 py-2">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => {
                                            const no = it.NoPkb ?? it.NoPKB ?? it.No ?? it.noPkb ?? it.no_pkb ?? '';
                                            const customer = [it.fname ?? it.FName ?? it.customerName ?? it.customer_name ?? it.customer ?? '', it.lname ?? it.Lname ?? '']
                                                .filter(Boolean)
                                                .join(' ')
                                                .trim();
                                            const vehicle = it.vehicleNumber ?? it.vehicle_number ?? it.vehicle ?? it.kendaraan ?? '';
                                            const status = it.DescStatusPkb ?? it.descStatusPkb ?? it.status ?? '';

                                            return (
                                                <tr key={idx} className="border-t">
                                                    <td className="px-3 py-2 align-top break-words">{no}</td>
                                                    <td className="px-3 py-2 align-top">{customer}</td>
                                                    <td className="px-3 py-2 align-top">{vehicle}</td>
                                                    <td className="px-3 py-2 align-top">{status}</td>
                                                    <td className="px-3 py-2 align-top">
                                                        <button
                                                            onClick={() => {
                                                                setSelected(it);
                                                                setShowDetail(true);
                                                            }}
                                                            className="px-2 py-1 text-sm bg-gray-200 rounded"
                                                        >
                                                            Detail
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="mt-4">
                            <Link href={route('sdms.dashboard')} className="px-4 py-2 bg-gray-200 rounded-lg">
                                Kembali
                            </Link>
                        </div>
                        {showDetail && (
                            <Modal title={`PKB Detail`} show={showDetail} onClose={() => setShowDetail(false)} maxWidth="3xl">
                                <div className="space-y-4">
                                    <div className="text-sm text-gray-700">
                                        <strong>No PKB:</strong> {selected?.NoPkb ?? selected?.NoPKB ?? selected?.No ?? selected?.noPkb}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        <strong>Customer:</strong> {[selected?.fname, selected?.lname].filter(Boolean).join(' ')}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        <strong>Vehicle:</strong> {selected?.vehicleNumber ?? selected?.vehicle ?? ''}
                                    </div>
                                    <details className="mt-2 p-2 bg-gray-50 rounded">
                                        <summary className="cursor-pointer">Raw JSON</summary>
                                        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(selected, null, 2)}</pre>
                                    </details>
                                </div>
                            </Modal>
                        )}
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}
