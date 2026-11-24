import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import PkbCreateForm from '@/Components/SDMS/PkbCreateForm';
import toast from 'react-hot-toast';

export default function SDMSPkbCreate({ sdms, pkb = null, localContext = {} }) {
    const [saving, setSaving] = useState(false);

    const initialValue = {
        ...localContext,
        vehicle: {
            ...localContext.vehicle,
            ...(pkb?.vehicle || {}),
        },
        owner: {
            ...localContext.owner,
            ...(pkb?.owner || {}),
        },
        carrier: {
            ...localContext.carrier,
            ...(pkb?.carrier || {}),
        },
        booking: {
            ...localContext.booking,
            ...(pkb?.booking || {}),
        },
        cad: pkb?.cad || localContext.cad,
        jobs: pkb?.jobs || localContext.jobs,
        estimate: pkb?.estimate || localContext.estimate,
        suggestions: pkb?.suggestions || localContext.suggestions,
        serviceHistory: pkb?.serviceHistory || localContext.serviceHistory,
    };

    const save = async (payload, mode) => {
        // Temuan 9.1 — pelindung klik ganda: abaikan pemanggilan selama
        // request simpan masih berjalan, supaya satu klik tidak membuat dua PKB.
        if (saving) return false;
        // Temuan 9.3 — catatan mode edit: `mode` diterima tapi sengaja belum
        // dipakai untuk membedakan endpoint. Metode update SDMS yang benar
        // (POST dengan id, atau method/endpoint lain) belum terkonfirmasi,
        // jadi edit saat ini masih POST ke endpoint create yang sama.
        // Jangan ubah method/endpoint ini sebelum Dany mengonfirmasi
        // perilaku API SDMS. Lihat juga editPkb() di SDMSAuthController:
        // formulir edit hanya menerima ['id' => $id], data PKB lama tidak
        // dimuat, jadi formulir edit mulai dari kosong.
        setSaving(true);
        try {
            const response = await axios.post('/api/docs-proxy/reception/Pkb', payload);
            toast.success(response.data?.message || 'PKB berhasil disimpan');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan PKB');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Temuan 9.4 — Save and Print benar-benar mencetak, dan hanya bila
    // simpan berhasil. Sebelumnya onSaveAndPrint === onSave, jadi tombol
    // ini hanya menyimpan tanpa pernah mencetak.
    const saveAndPrint = async (payload, mode) => {
        const ok = await save(payload, mode);
        if (ok) window.print();
    };

    return (
        <>
            <Head title={pkb ? 'Edit PKB' : 'Create PKB'} />
            <PkbCreateForm
                initialValue={initialValue}
                mode={pkb ? 'edit' : 'create'}
                saving={saving}
                onSave={save}
                onSaveAndPrint={saveAndPrint}
                onPrint={() => window.print()}
            />
        </>
    );
}
