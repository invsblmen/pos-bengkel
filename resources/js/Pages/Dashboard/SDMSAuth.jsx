import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import { Card, CardBody, CardHeader, CardTitle } from '@/Components/Card';
import SDMSAuthModal from '@/Components/Dashboard/SDMSAuthModal';
import SDMSSessionStatus from '@/Components/Dashboard/SDMSSessionStatus';

export default function SDMSAuth({ sdms }) {
    const [showLoginModal, setShowLoginModal] = useState(true);
    const isAuthenticated = Boolean(sdms?.authenticated);

    return (
        <>
            <Head title="Autentikasi SDMS" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Autentikasi SDMS</h1>
                    <p className="text-gray-600">Halaman fallback untuk login SDMS via popup.</p>
                </div>

                <SDMSSessionStatus sdms={sdms} />

                <Card>
                    <CardHeader>
                        <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600">
                                {isAuthenticated ? 'Sesi SDMS sudah aktif. Anda bisa mengganti kredensial lewat popup.' : 'Popup login SDMS akan terbuka otomatis.'}
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowLoginModal(true)}
                                className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500"
                            >
                                Buka popup login SDMS
                            </button>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <SDMSAuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} sdms={sdms} />
        </>
    );
}
