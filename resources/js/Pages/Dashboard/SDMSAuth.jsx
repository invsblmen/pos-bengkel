import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import toast from 'react-hot-toast';

export default function SDMSAuth({ sdms }) {
    const { flash, errors } = usePage().props;
    const [form, setForm] = useState({ idInternal: '', username: '', password: '' });
    const [loading, setLoading] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        setLoading(true);
        router.post(route('sdms.auth.login'), form, {
            onSuccess: () => {
                toast.success('Token diterima');
                setLoading(false);
            },
            onError: () => setLoading(false),
        });
    };

    return (
        <DashboardLayout>
            <Head title="Autentikasi SDMS" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Autentikasi SDMS</h1>
                    <p className="text-gray-600">Login ke SDMS Dealer API dari dashboard.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Masuk</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">ID Internal</label>
                                <input
                                    value={form.idInternal}
                                    onChange={(e) => setForm({ ...form, idInternal: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                                {errors.idInternal && <p className="text-xs text-red-600 mt-1">{errors.idInternal}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Username</label>
                                <input
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                                {errors.username && <p className="text-xs text-red-600 mt-1">{errors.username}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Password</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                                {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                            </div>

                            <div className="flex items-center gap-4">
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                                    {loading ? 'Loading...' : 'Login'}
                                </button>

                                {(sdms?.access_token || sdms?.id_token) && (
                                    <div className="flex-1 px-4 py-2 border rounded-lg break-words">
                                        <p className="text-xs text-gray-500">Saved token:</p>
                                        <p className="text-sm">{sdms?.access_token ?? sdms?.id_token}</p>
                                    </div>
                                )}
                            </div>

                            {flash && flash.success && <p className="text-sm text-green-600">{flash.success}</p>}
                            {errors.global && <p className="text-sm text-red-600">{errors.global}</p>}
                        </form>
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}
