import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import SDMSAuthModal from '@/Components/Dashboard/SDMSAuthModal';
import SDMSSessionStatus from '@/Components/Dashboard/SDMSSessionStatus';

export default function SDMSDashboard({ sdms }) {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const isAuthenticated = Boolean(sdms && (sdms.access_token || sdms.id_token));

    return (
        <>
            <Head title="SDMS Dashboard" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">SDMS Dashboard</h1>
                    <p className="text-gray-600">Status koneksi dan token untuk SDMS Dealer API.</p>
                </div>

                <SDMSSessionStatus sdms={sdms} />

                <Card>
                    <CardHeader>
                        <CardTitle>Status Autentikasi</CardTitle>
                    </CardHeader>
                    <CardBody>
                        {!isAuthenticated ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">Anda belum login ke SDMS.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginModal(true)}
                                        className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500"
                                    >
                                        Login SDMS
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginModal(true)}
                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
                                    >
                                        Buka popup login
                                    </button>
                                </div>
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
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginModal(true)}
                                        className="px-4 py-2 bg-gray-200 rounded-lg"
                                    >
                                        Login Ulang / Ganti Kredensial
                                    </button>
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

            <SDMSAuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} sdms={sdms} />
        </>
    );
}
