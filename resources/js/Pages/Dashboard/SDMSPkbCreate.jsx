import React from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import PkbCreateForm from '@/Components/SDMS/PkbCreateForm';
import toast from 'react-hot-toast';

export default function SDMSPkbCreate({ sdms, pkb = null, localContext = {} }) {
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

    const save = async (payload) => {
        try {
            const response = await axios.post('/api/docs-proxy/reception/Pkb', payload);
            toast.success(response.data?.message || 'PKB berhasil disimpan');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan PKB');
        }
    };

    return (
        <>
            <Head title={pkb ? 'Edit PKB' : 'Create PKB'} />
            <PkbCreateForm
                initialValue={initialValue}
                mode={pkb ? 'edit' : 'create'}
                onSave={save}
                onSaveAndPrint={save}
                onPrint={() => window.print()}
            />
        </>
    );
}
