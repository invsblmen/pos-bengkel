import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';

export default function SDMSDashboard({ sdms }) {
    return (
        <>
            <Head title="SDMS Dashboard" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">SDMS Dashboard</h1>
                    <p className="text-gray-600">Status koneksi dan token untuk SDMS Dealer API.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Status Autentikasi</CardTitle>
                    </CardHeader>
                    <CardBody>
                        {!sdms || !(sdms.access_token || sdms.id_token) ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Anda belum login ke SDMS.</p>
                                <Link href={route('sdms.auth.index')} className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg">
                                    Login ke SDMS
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Token aktif (tersimpan di session):</p>
                                <pre className="p-3 bg-gray-50 rounded overflow-auto text-xs">{sdms.access_token ?? sdms.id_token}</pre>
                                {sdms.token_type && <p className="text-xs text-gray-500">Type: {sdms.token_type}</p>}
                                {sdms.expires_in && <p className="text-xs text-gray-500">Expires in: {sdms.expires_in} seconds</p>}
                                <div className="flex gap-3">
                                    <a href={(window && window.__SDMS_BASE_URL__) || '/'} target="_blank" rel="noreferrer" className="px-4 py-2 border rounded-lg">
                                        Buka SDMS (external)
                                    </a>
                                    <Link href={route('sdms.auth.index')} className="px-4 py-2 bg-gray-200 rounded-lg">
                                        Login Ulang / Ganti Kredensial
                                    </Link>
                                </div>
                                {sdms.raw && (
                                    <details className="mt-4 p-3 border rounded bg-gray-50">
                                        <summary className="cursor-pointer text-sm text-gray-700">Raw response (debug)</summary>
                                        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(sdms.raw, null, 2)}</pre>
                                    </details>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </>
    );
}
