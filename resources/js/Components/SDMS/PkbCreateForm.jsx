import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { IconArrowLeft, IconArrowRight, IconCalendarEvent, IconCheck, IconChevronRight, IconDeviceFloppy, IconPlus, IconPrinter, IconTrash } from '@tabler/icons-react';

const formatRupiah = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
}).format(Number(value || 0));

const requiredFields = {
    0: [
        ['vehicle.plateNumber', 'Nomor Polisi'],
        ['vehicle.engineNumber', 'Nomor Mesin'],
        ['vehicle.chassisNumber', 'Nomor Rangka'],
        ['vehicle.vehicleType', 'Tipe Kendaraan'],
        ['vehicle.assemblyYear', 'Tahun Rakit'],
        ['vehicle.color', 'Warna'],
        ['vehicle.purchaseDealer', 'Dealer Pembelian'],
        ['vehicle.purchaseDate', 'Tanggal Pembelian'],
        ['vehicle.odometer', 'Kilometer'],
    ],
    1: [
        ['owner.name', 'Nama STNK'],
        ['owner.address', 'Alamat Pemilik'],
        ['owner.nik', 'NIK'],
        ['owner.province', 'Provinsi'],
        ['owner.birthDate', 'Tanggal Lahir'],
        ['owner.city', 'Kota/Kabupaten'],
        ['owner.consumerCategory', 'Kategori Konsumen'],
        ['owner.district', 'Kecamatan'],
        ['owner.phone1', 'No Handphone 1'],
        ['owner.village', 'Kelurahan/Desa'],
        ['owner.email', 'Email'],
        ['carrier.name', 'Nama Pembawa'],
        ['carrier.address', 'Alamat Pembawa'],
        ['carrier.phone1', 'No Handphone Pembawa'],
        ['carrier.province', 'Provinsi Pembawa'],
        ['carrier.city', 'Kota/Kabupaten Pembawa'],
        ['carrier.relationship', 'Hubungan Pembawa & Pemilik'],
        ['carrier.district', 'Kecamatan Pembawa'],
        ['carrier.visitReason', 'Alasan ke AHASS'],
        ['carrier.village', 'Kelurahan/Desa Pembawa'],
    ],
};

const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);

const initialData = (initialValue = {}) => ({
    vehicle: {
        plateNumber: '', engineNumber: '', chassisNumber: '', vehicleType: '', assemblyYear: '',
        color: '', purchaseDealer: '', purchaseDate: '', odometer: '', qrCode: '', serviceBookNumber: '',
        previousOdometer: 0, fuelIndicator: '1/2', ...initialValue.vehicle,
    },
    owner: {
        name: '', address: '', nik: '', province: '', birthDate: '', city: '', consumerCategory: '',
        district: '', phone1: '', phone2: '', village: '', npwp: '', socialMedia: 'Instagram',
        socialMediaInput: '', top: '', email: '', ...initialValue.owner,
    },
    carrier: {
        sameAsOwner: false, name: '', address: '', phone1: '', phone2: '', province: '', city: '',
        relationship: '', district: '', visitReason: '', village: '', ...initialValue.carrier,
    },
    lcr: {
        customerAvailability: '', rejectionReason: '', inspectionResult: '', ...initialValue.lcr,
    },
    serviceHistory: initialValue.serviceHistory || [],
    suggestions: initialValue.suggestions || [],
    cad: initialValue.cad || [
        'OLI MESIN', 'KABEL KOPLING DAN GAS', 'BUSI', 'KAMPAS REM DEPAN', 'KAMPAS REM BELAKANG',
        'BAN', 'SEAL FORK DEPAN', 'KELISTRIKAN DAN LAMPU', 'AKI DAN BATERAI', 'MINYAK DAN SISTEM REM',
    ].map((part) => ({ part, condition: 'Warning', partCode: '' })),
    jobs: initialValue.jobs || [],
    estimate: {
        queueType: '', promotion: 'Non Promotion', serviceDiscount: 0, serviceDiscountPercent: 0,
        partDiscount: 0, partDiscountPercent: 0, depositBalance: 0, totalDownPayment: 0,
        waitingMode: 'ditunggu', estimatedMinutes: 30, registrationTime: '', startTime: '',
        ...initialValue.estimate,
    },
    booking: {
        found: false, bookingNumber: '', customerName: '', phone: '', date: '', notes: '',
        ...initialValue.booking,
    },
    jobSuggest: initialValue.jobSuggest || '',
    saRecommendation: initialValue.saRecommendation || '',
    aiRecommendation: initialValue.aiRecommendation || '',
    complaint: initialValue.complaint || '',
    promoInfo: initialValue.promoInfo || '',
});

export function Field({ label, required, error, className = '', children }) {
    return (
        <label className={`block ${className}`}>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {label} {required && <b className="text-red-500">*</b>}
            </span>
            {children}
            {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
        </label>
    );
}

const inputClass = 'mt-0 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

const Input = ({ className = '', ...props }) => <input className={`${inputClass} ${className}`} {...props} />;
const Select = ({ className = '', children, ...props }) => <select className={`${inputClass} ${className}`} {...props}>{children}</select>;

export function StepNavigation({ step, total, onBack, onNext }) {
    return (
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" onClick={onBack} disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
                <IconArrowLeft size={17} /> Back
            </button>
            <span className="text-xs font-medium text-slate-500">{step + 1} / {total}</span>
            <button type="button" onClick={onNext}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                {step === total - 1 ? 'Selesai' : 'Next'} <IconArrowRight size={17} />
            </button>
        </div>
    );
}

export function VehicleStep({ data, setData, errors }) {
    const [lookupLoading, setLookupLoading] = useState(false);
    const setVehicle = (key, value) => setData((current) => ({ ...current, vehicle: { ...current.vehicle, [key]: value } }));

    const lookupVehicle = async () => {
        if (!data.vehicle.plateNumber && !data.vehicle.engineNumber && !data.vehicle.chassisNumber && !data.vehicle.qrCode) return;
        setLookupLoading(true);
        try {
            const response = await axios.get('/api/docs-proxy/reception/VehicleLookup', {
                params: {
                    plateNumber: data.vehicle.plateNumber,
                    engineNumber: data.vehicle.engineNumber,
                    chassisNumber: data.vehicle.chassisNumber,
                    qrCode: data.vehicle.qrCode,
                },
            });
            const payload = response.data?.data ?? response.data?.result ?? response.data ?? {};
            setData((current) => ({
                ...current,
                vehicle: {
                    ...current.vehicle,
                    plateNumber: payload.plateNumber ?? payload.vehicleNumber ?? payload.nomorPolisi ?? current.vehicle.plateNumber,
                    engineNumber: payload.engineNumber ?? payload.nomorMesin ?? current.vehicle.engineNumber,
                    chassisNumber: payload.chassisNumber ?? payload.nomorRangka ?? current.vehicle.chassisNumber,
                    vehicleType: payload.vehicleType ?? payload.marketName ?? payload.tipeKendaraan ?? current.vehicle.vehicleType,
                    assemblyYear: payload.assemblyYear ?? payload.year ?? payload.tahunRakit ?? current.vehicle.assemblyYear,
                    color: payload.color ?? payload.warna ?? current.vehicle.color,
                    odometer: payload.odometer ?? payload.kilometer ?? current.vehicle.odometer,
                },
            }));
        } catch (error) {
            // Temuan 9.5 — lookup yang gagal (mis. sesi SDMS kedaluwarsa)
            // sebelumnya diam saja karena hanya ada try/finally tanpa catch.
            toast.error(error.response?.data?.message || 'Gagal mengambil data kendaraan dari SDMS');
        } finally {
            setLookupLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Nomor Polisi" required error={errors['vehicle.plateNumber']}><Input value={data.vehicle.plateNumber} onChange={(e) => setVehicle('plateNumber', e.target.value.toUpperCase())} /></Field>
                <Field label="Nomor Mesin" required error={errors['vehicle.engineNumber']}><Input value={data.vehicle.engineNumber} onChange={(e) => setVehicle('engineNumber', e.target.value)} /></Field>
                <Field label="Nomor Rangka" required error={errors['vehicle.chassisNumber']}><Input value={data.vehicle.chassisNumber} onChange={(e) => setVehicle('chassisNumber', e.target.value)} /></Field>
                <Field label="Tipe Kendaraan" required error={errors['vehicle.vehicleType']}><Input value={data.vehicle.vehicleType} onChange={(e) => setVehicle('vehicleType', e.target.value)} /></Field>
                <Field label="Tahun Rakit" required error={errors['vehicle.assemblyYear']}><Input type="number" value={data.vehicle.assemblyYear} onChange={(e) => setVehicle('assemblyYear', e.target.value)} /></Field>
                <Field label="Warna" required error={errors['vehicle.color']}><Input value={data.vehicle.color} onChange={(e) => setVehicle('color', e.target.value)} /></Field>
                <Field label="Dealer Pembelian" required error={errors['vehicle.purchaseDealer']}><Input value={data.vehicle.purchaseDealer} onChange={(e) => setVehicle('purchaseDealer', e.target.value)} /></Field>
                <Field label="Tanggal Pembelian" required error={errors['vehicle.purchaseDate']}>
                    <div className="flex gap-2">
                        <Input type="date" value={data.vehicle.purchaseDate} onChange={(e) => setVehicle('purchaseDate', e.target.value)} />
                        <button type="button" className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Get Tgl Faktur</button>
                    </div>
                </Field>
                <Field label="Kilometer" required error={errors['vehicle.odometer']}><Input type="number" min="0" value={data.vehicle.odometer} onChange={(e) => setVehicle('odometer', e.target.value)} /></Field>
                <Field label="QR Code">
                    <div className="flex gap-2">
                        <Input value={data.vehicle.qrCode} onChange={(e) => setVehicle('qrCode', e.target.value)} placeholder="QR Code" />
                        <button type="button" onClick={lookupVehicle} disabled={lookupLoading} className="shrink-0 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-60 dark:bg-slate-700">
                            {lookupLoading ? 'Memuat...' : '+ dari API'}
                        </button>
                    </div>
                </Field>
                <Field label="Nomor Buku Service"><Input value={data.vehicle.serviceBookNumber} onChange={(e) => setVehicle('serviceBookNumber', e.target.value)} /></Field>
                <Field label="Kilometer Sebelumnya"><Input type="number" value={data.vehicle.previousOdometer} readOnly /></Field>
                <Field label="Indikator Bahan Bakar">
                    <Select value={data.vehicle.fuelIndicator} onChange={(e) => setVehicle('fuelIndicator', e.target.value)}>
                        {['0', '1/4', '1/2', '3/4', 'Full'].map((option) => <option key={option}>{option}</option>)}
                    </Select>
                </Field>
            </div>
        </div>
    );
}

export function ConsumerStep({ data, setData, errors }) {
    const setOwner = (key, value) => setData((current) => ({ ...current, owner: { ...current.owner, [key]: value } }));
    const setCarrier = (key, value) => setData((current) => ({ ...current, carrier: { ...current.carrier, [key]: value } }));
    const carrierSame = (checked) => setData((current) => ({
        ...current,
        carrier: checked ? {
            ...current.carrier, sameAsOwner: true, name: current.owner.name, address: current.owner.address,
            phone1: current.owner.phone1, phone2: current.owner.phone2, province: current.owner.province,
            city: current.owner.city, district: current.owner.district, village: current.owner.village,
        } : { ...current.carrier, sameAsOwner: false },
    }));

    return (
        <div className="space-y-6">
            <section>
                <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-white">Data Pemilik</h3><button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">Ganti Pemilik</button></div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Nama STNK" required error={errors['owner.name']}><Input value={data.owner.name} onChange={(e) => setOwner('name', e.target.value)} /></Field>
                    <Field label="Alamat" required error={errors['owner.address']}><Input value={data.owner.address} onChange={(e) => setOwner('address', e.target.value)} /></Field>
                    <Field label="NIK" required error={errors['owner.nik']}><Input value={data.owner.nik} onChange={(e) => setOwner('nik', e.target.value)} /></Field>
                    <Field label="Provinsi" required error={errors['owner.province']}><Select value={data.owner.province} onChange={(e) => setOwner('province', e.target.value)}><option value="">Pilih Provinsi</option><option>Jawa Timur</option><option>Jawa Tengah</option><option>Jawa Barat</option></Select></Field>
                    <Field label="Tanggal Lahir" required error={errors['owner.birthDate']}><Input type="date" value={data.owner.birthDate} onChange={(e) => setOwner('birthDate', e.target.value)} /></Field>
                    <Field label="Kota/Kabupaten" required error={errors['owner.city']}><Select value={data.owner.city} onChange={(e) => setOwner('city', e.target.value)}><option value="">Pilih Kota/Kabupaten</option><option>Surabaya</option><option>Malang</option><option>Jakarta</option></Select></Field>
                    <Field label="Kategori Konsumen" required error={errors['owner.consumerCategory']}><Select value={data.owner.consumerCategory} onChange={(e) => setOwner('consumerCategory', e.target.value)}><option value="">Pilih kategori</option>{['AHASS/Partshop', 'Retail', 'Karyawan', 'Group Customer', 'Intern'].map((item) => <option key={item}>{item}</option>)}</Select></Field>
                    <Field label="Kecamatan" required error={errors['owner.district']}><Select value={data.owner.district} onChange={(e) => setOwner('district', e.target.value)}><option value="">Pilih Kecamatan</option></Select></Field>
                    <Field label="No Handphone 1" required error={errors['owner.phone1']}><Input value={data.owner.phone1} onChange={(e) => setOwner('phone1', e.target.value)} /></Field>
                    <Field label="Kelurahan/Desa" required error={errors['owner.village']}><Select value={data.owner.village} onChange={(e) => setOwner('village', e.target.value)}><option value="">Pilih Kelurahan/Desa</option></Select></Field>
                    <Field label="No Handphone 2"><Input value={data.owner.phone2} onChange={(e) => setOwner('phone2', e.target.value)} /></Field>
                    <Field label="NPWP"><Input value={data.owner.npwp} onChange={(e) => setOwner('npwp', e.target.value)} /></Field>
                    <Field label="Media Sosial">
                        <div className="flex flex-wrap gap-3">
                            {['Facebook', 'Instagram', 'Twitter', 'Youtube'].map((item) => <label key={item} className="inline-flex items-center gap-1.5 text-sm"><input type="radio" name="socialMedia" checked={data.owner.socialMedia === item} onChange={() => setOwner('socialMedia', item)} /> {item}</label>)}
                        </div>
                        <Input className="mt-2" value={data.owner.socialMediaInput} onChange={(e) => setOwner('socialMediaInput', e.target.value)} placeholder="Username / URL" />
                    </Field>
                    <Field label="TOP"><Input value={data.owner.top} onChange={(e) => setOwner('top', e.target.value)} /></Field>
                    <Field label="Email" required error={errors['owner.email']}><Input type="email" value={data.owner.email} onChange={(e) => setOwner('email', e.target.value)} /></Field>
                </div>
            </section>
            <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
                <label className="mb-4 inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={data.carrier.sameAsOwner} onChange={(e) => carrierSame(e.target.checked)} /> Data Pembawa sama dengan Pemilik</label>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Nama Pembawa" required error={errors['carrier.name']}><Input value={data.carrier.name} onChange={(e) => setCarrier('name', e.target.value)} /></Field>
                    <Field label="Alamat" required error={errors['carrier.address']}><Input value={data.carrier.address} onChange={(e) => setCarrier('address', e.target.value)} /></Field>
                    <Field label="No Handphone 1" required error={errors['carrier.phone1']}><div className="flex gap-2"><Input value={data.carrier.phone1} onChange={(e) => setCarrier('phone1', e.target.value)} /><button type="button" className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">Cek Loyalitas</button></div></Field>
                    <Field label="Provinsi" required error={errors['carrier.province']}><Select value={data.carrier.province} onChange={(e) => setCarrier('province', e.target.value)}><option value="">Pilih Provinsi</option><option>Jawa Timur</option></Select></Field>
                    <Field label="No Handphone 2"><Input value={data.carrier.phone2} onChange={(e) => setCarrier('phone2', e.target.value)} /></Field>
                    <Field label="Kota/Kabupaten" required error={errors['carrier.city']}><Select value={data.carrier.city} onChange={(e) => setCarrier('city', e.target.value)}><option value="">Pilih Kota/Kabupaten</option></Select></Field>
                    <Field label="Hubungan Pembawa & Pemilik" required error={errors['carrier.relationship']}><Select value={data.carrier.relationship} onChange={(e) => setCarrier('relationship', e.target.value)}><option value="">Pilih hubungan</option><option>Diri Sendiri</option><option>Keluarga</option><option>Teman</option><option>Karyawan</option></Select></Field>
                    <Field label="Kecamatan" required error={errors['carrier.district']}><Select value={data.carrier.district} onChange={(e) => setCarrier('district', e.target.value)}><option value="">Pilih Kecamatan</option></Select></Field>
                    <Field label="Alasan ke AHASS" required error={errors['carrier.visitReason']}><Select value={data.carrier.visitReason} onChange={(e) => setCarrier('visitReason', e.target.value)}><option value="">Pilih alasan</option>{['Inisiatif sendiri', 'WA Reminder', 'Lainnya', 'Telp Reminder', 'Sticker Reminder'].map((item) => <option key={item}>{item}</option>)}</Select></Field>
                    <Field label="Kelurahan/Desa" required error={errors['carrier.village']}><Select value={data.carrier.village} onChange={(e) => setCarrier('village', e.target.value)}><option value="">Pilih Kelurahan/Desa</option></Select></Field>
                </div>
            </section>
        </div>
    );
}

export function LcrStep({ data, setData, errors }) {
    const setLcr = (key, value) => setData((current) => ({ ...current, lcr: { ...current.lcr, [key]: value } }));
    return (
        <div className="space-y-5">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>{['No', 'Steps', 'Kode Dealer', 'Tanggal PKB', 'Kesediaan Konsumen', 'Alasan Penolakan Konsumen', 'Hasil Pengecekan', 'Batal PKB?'].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}</tr>
                    </thead>
                    <tbody><tr><td colSpan="8" className="px-4 py-10 text-center text-slate-500">No records found</td></tr></tbody>
                </table>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Field label="Kesediaan Customer Check" required error={errors['lcr.customerAvailability']}><Select value={data.lcr.customerAvailability} onChange={(e) => setLcr('customerAvailability', e.target.value)}><option value="">Pilih</option><option>Bersedia</option><option>Tidak Bersedia</option></Select></Field>
                <Field label="Alasan Tidak Bersedia" required error={errors['lcr.rejectionReason']}><Select value={data.lcr.rejectionReason} onChange={(e) => setLcr('rejectionReason', e.target.value)}><option value="">Pilih alasan</option><option>Biaya terlalu mahal</option><option>Belum diperlukan</option><option>Lainnya</option></Select></Field>
                <Field label="Hasil Pengecekan" required error={errors['lcr.inspectionResult']}><Select value={data.lcr.inspectionResult} onChange={(e) => setLcr('inspectionResult', e.target.value)}><option value="">Pilih hasil</option><option>Baik</option><option>Perlu perawatan</option><option>Berbahaya</option></Select></Field>
            </div>
        </div>
    );
}

export function ServiceHistoryStep({ data }) {
    const histories = data.serviceHistory || [];
    if (!histories.length) return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Belum ada riwayat servis untuk kendaraan ini.</div>;
    return (
        <div className="grid gap-3">
            {histories.map((item, index) => (
                <article key={item.id || index} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div><h3 className="font-semibold text-slate-900 dark:text-white">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{item.location || '-'} • {item.km || 0} KM • {item.date || '-'}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mekanik: {item.mechanic || '-'} • Job Suggest: {item.jobSuggest || '-'}</p></div>
                    <button type="button" className="rounded-xl border border-slate-200 p-2"><IconChevronRight size={18} /></button>
                </article>
            ))}
        </div>
    );
}

export function SuggestionStep({ data, setData }) {
    const suggestions = data.suggestions || [];
    const allSelected = suggestions.length > 0 && suggestions.every((item) => item.selected);
    const toggleAll = (checked) => setData((current) => ({ ...current, suggestions: current.suggestions.map((item) => ({ ...item, selected: checked })) }));
    const toggle = (index, checked) => setData((current) => ({ ...current, suggestions: current.suggestions.map((item, itemIndex) => itemIndex === index ? { ...item, selected: checked } : item) }));
    if (!suggestions.length) return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Tidak ada saran pekerjaan.</div>;
    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th><th className="px-4 py-3">Pekerjaan / Parts</th><th className="px-4 py-3 text-right">Harga</th></tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{suggestions.map((item, index) => <tr key={item.id || index}><td className="px-4 py-3"><input type="checkbox" checked={Boolean(item.selected)} onChange={(e) => toggle(index, e.target.checked)} /></td><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3 text-right">{formatRupiah(item.price)}</td></tr>)}</tbody>
            </table>
        </div>
    );
}

export function CadStep({ data, setData, onSavePrint, saving = false }) {
    const setCad = (index, key, value) => setData((current) => ({
        ...current,
        cad: current.cad.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
    }));
    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-3 text-left">Part</th><th className="px-4 py-3 text-left">Condition</th><th className="px-4 py-3 text-left">Kode Part</th></tr></thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{data.cad.map((row, index) => (
                        <tr key={row.part}><td className="px-4 py-3 font-medium">{row.part}</td><td className="px-4 py-3"><div className="flex gap-4">{['OK', 'Warning', 'Not OK'].map((condition) => <label key={condition} className="inline-flex items-center gap-1.5"><input type="radio" name={`cad-${index}`} checked={row.condition === condition} onChange={() => setCad(index, 'condition', condition)} /> {condition}</label>)}</div></td><td className="px-4 py-3"><Input list={`cad-parts-${index}`} value={row.partCode} onChange={(e) => setCad(index, 'partCode', e.target.value)} placeholder="Insert part name" /><datalist id={`cad-parts-${index}`}><option value="ASLI AHASS" /><option value="OLI MPX 1" /><option value="BUSI DENSO" /></datalist></td></tr>
                    ))}</tbody>
                </table>
            </div>
            <button type="button" onClick={onSavePrint} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-slate-700"><IconPrinter size={17} /> {saving ? 'Menyimpan...' : 'Save and Print CAD'}</button>
        </div>
    );
}

export function JobsStep({ data, setData }) {
    const addJob = () => setData((current) => ({ ...current, jobs: [...current.jobs, { id: crypto.randomUUID?.() || Date.now(), group: '', name: '', discount: 0, price: 0, flatRate: 0, chargeTo: 'Customer', recommended: false, parts: [] }] }));
    const updateJob = (index, key, value) => setData((current) => ({ ...current, jobs: current.jobs.map((job, jobIndex) => jobIndex === index ? { ...job, [key]: value } : job) }));
    const removeJob = (index) => setData((current) => ({ ...current, jobs: current.jobs.filter((_, jobIndex) => jobIndex !== index) }));
    const addPart = (jobIndex) => setData((current) => ({ ...current, jobs: current.jobs.map((job, index) => index === jobIndex ? { ...job, parts: [...(job.parts || []), { id: Date.now(), selected: true, name: '', qty: 1, available: 0, het: 0, discount: 0 }] } : job) }));
    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <Field label="Job Suggest (Rekomendasi SA/Mekanik)"><textarea className={inputClass} value={data.jobSuggest} onChange={(e) => setData((current) => ({ ...current, jobSuggest: e.target.value }))} /></Field>
                <Field label="Rekomendasi AI Service"><textarea className={inputClass} value={data.aiRecommendation} onChange={(e) => setData((current) => ({ ...current, aiRecommendation: e.target.value }))} /></Field>
                <Field label="Keluhan"><textarea className={inputClass} value={data.complaint} onChange={(e) => setData((current) => ({ ...current, complaint: e.target.value }))} /></Field>
                <Field label="Informasi Promo"><textarea className={inputClass} value={data.promoInfo} onChange={(e) => setData((current) => ({ ...current, promoInfo: e.target.value }))} /></Field>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={addJob} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><IconPlus size={16} /> Pekerjaan</button><button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">+ Parts All</button></div>
            {data.jobs.map((job, index) => (
                <div key={job.id || index} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <Field label="Kelompok Jasa"><Select value={job.group} onChange={(e) => updateJob(index, 'group', e.target.value)}><option value="">Pilih kelompok</option>{['PAKET LENGKAP', 'Light Repair', 'Heavy Repair', 'Quick Service', 'General Check'].map((item) => <option key={item}>{item}</option>)}</Select></Field>
                        <Field label="Nama Jasa"><Input value={job.name} onChange={(e) => updateJob(index, 'name', e.target.value)} placeholder="Cari minimal 3 karakter" /></Field>
                        <Field label="Disc"><Input type="number" min="0" value={job.discount} onChange={(e) => updateJob(index, 'discount', e.target.value)} /></Field>
                        <Field label="Charge to"><Select value={job.chargeTo} onChange={(e) => updateJob(index, 'chargeTo', e.target.value)}><option>Customer</option><option>Warranty</option><option>Promo</option></Select></Field>
                        <div className="flex items-end justify-between gap-2"><label className="mb-2 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={job.recommended} onChange={(e) => updateJob(index, 'recommended', e.target.checked)} /> Disarankan Mekanik</label><button type="button" onClick={() => removeJob(index)} className="mb-1 rounded-xl p-2 text-red-600"><IconTrash size={18} /></button></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-500"><span>Harga: <b>{formatRupiah(job.price)}</b></span><span>Diskon: <b>{formatRupiah(job.discount)}</b></span><span>Flat Rate: <b>{job.flatRate || 0}</b></span></div>
                    <button type="button" onClick={() => addPart(index)} className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">+ Part</button>
                    {job.parts?.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-500"><tr><th></th><th className="text-left">Parts</th><th>Qty</th><th>Avs</th><th>HET</th><th>Disc</th><th>Total</th><th></th></tr></thead><tbody>{job.parts.map((part, partIndex) => {
                        const total = Math.max(0, Number(part.qty || 0) * Number(part.het || 0) - Number(part.discount || 0));
                        return <tr key={part.id || partIndex}><td><input type="checkbox" checked={part.selected} onChange={(e) => { const jobs = data.jobs.map((j, i) => i === index ? { ...j, parts: j.parts.map((p, pi) => pi === partIndex ? { ...p, selected: e.target.checked } : p) } : j); setData((current) => ({ ...current, jobs })); }} /></td><td>{part.name || '-'}</td><td className="text-center">{part.qty}</td><td className="text-center">{part.available}</td><td className="text-right">{formatRupiah(part.het)}</td><td className="text-right">{formatRupiah(part.discount)}</td><td className="text-right">{formatRupiah(total)}</td><td><button type="button" className="text-xs font-semibold text-emerald-700">Edit</button></td></tr>;
                    })}</tbody></table></div>}
                </div>
            ))}
            {!data.jobs.length && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Belum ada pekerjaan yang ditambahkan.</div>}
        </div>
    );
}

const minutesToTime = (time, minutes) => {
    if (!time) return '';
    const [hours, mins] = time.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return '';
    const total = (hours * 60 + mins + Number(minutes || 0)) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export function EstimateStep({ data, setData }) {
    const setEstimate = (key, value) => setData((current) => ({ ...current, estimate: { ...current.estimate, [key]: value } }));

    const serviceRows = useMemo(() => data.jobs.map((job) => ({
        name: job.name || job.group || 'Pekerjaan',
        price: Number(job.price || 0),
        discount: Number(job.discount || 0),
    })), [data.jobs]);
    const partRows = useMemo(() => data.jobs.flatMap((job) => (job.parts || []).filter((part) => part.selected).map((part) => ({
        name: part.name || 'Parts',
        qty: Number(part.qty || 0),
        price: Number(part.het || 0),
        discount: Number(part.discount || 0),
        description: '',
    }))), [data.jobs]);

    const serviceSubtotal = serviceRows.reduce((total, row) => total + Math.max(0, row.price - row.discount), 0);
    const partSubtotal = partRows.reduce((total, row) => total + Math.max(0, row.qty * row.price - row.discount), 0);

    const serviceDiscountPercent = Number(data.estimate.serviceDiscountPercent || 0);
    const partDiscountPercent = Number(data.estimate.partDiscountPercent || 0);
    const estimatedServiceDiscount = Number(data.estimate.serviceDiscount || 0);
    const estimatedPartDiscount = Number(data.estimate.partDiscount || 0);
    const total = Math.max(0, serviceSubtotal - estimatedServiceDiscount + partSubtotal - estimatedPartDiscount);
    const startTime = data.estimate.startTime || data.estimate.registrationTime || '';
    const estimatedFinish = minutesToTime(startTime, data.estimate.estimatedMinutes);

    const updateServiceAmount = (value) => {
        const amount = Number(value || 0);
        setData((current) => ({
            ...current,
            estimate: { ...current.estimate, serviceDiscount: amount, serviceDiscountPercent: serviceSubtotal ? (amount / serviceSubtotal) * 100 : 0 },
        }));
    };
    const updateServicePercent = (value) => {
        const percent = Number(value || 0);
        setData((current) => ({
            ...current,
            estimate: { ...current.estimate, serviceDiscountPercent: percent, serviceDiscount: serviceSubtotal * percent / 100 },
        }));
    };
    const updatePartAmount = (value) => {
        const amount = Number(value || 0);
        setData((current) => ({
            ...current,
            estimate: { ...current.estimate, partDiscount: amount, partDiscountPercent: partSubtotal ? (amount / partSubtotal) * 100 : 0 },
        }));
    };
    const updatePartPercent = (value) => {
        const percent = Number(value || 0);
        setData((current) => ({
            ...current,
            estimate: { ...current.estimate, partDiscountPercent: percent, partDiscount: partSubtotal * percent / 100 },
        }));
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <Field label="Jenis Antrian"><Select value={data.estimate.queueType} onChange={(e) => setEstimate('queueType', e.target.value)}><option value="">Pilih jenis antrian</option><option>Regular</option><option>Pit Express</option><option>Booking</option></Select></Field>
                <Field label="Activity Promotion"><Select value={data.estimate.promotion} onChange={(e) => setEstimate('promotion', e.target.value)}><option>Non Promotion</option><option>AHASS Event yang di Develop oleh MD</option><option>Pit Express</option><option>Reminder (WA Reminder)</option><option>Inisiatif Sendiri</option></Select></Field>
            </div>
            <section>
                <h3 className="mb-2 font-semibold">Ringkasan Service</h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-3 py-3 text-left">Service</th><th className="px-3 py-3 text-right">Harga</th><th className="px-3 py-3 text-right">Diskon</th><th className="px-3 py-3 text-right">Subtotal</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{serviceRows.map((row, index) => <tr key={index}><td className="px-3 py-3">{row.name}</td><td className="px-3 py-3 text-right">{formatRupiah(row.price)}</td><td className="px-3 py-3 text-right">{formatRupiah(row.discount)}</td><td className="px-3 py-3 text-right">{formatRupiah(row.price - row.discount)}</td></tr>)}</tbody></table></div>
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3 dark:bg-slate-900"><div className="font-semibold">Subtotal: {formatRupiah(serviceSubtotal)}</div><Field label="Diskon"><Input type="number" min="0" value={estimatedServiceDiscount} onChange={(e) => updateServiceAmount(e.target.value)} /></Field><Field label="Diskon (%)"><Input type="number" min="0" max="100" value={serviceDiscountPercent} onChange={(e) => updateServicePercent(e.target.value)} /></Field></div>
            </section>
            <section>
                <h3 className="mb-2 font-semibold">Ringkasan Parts</h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-3 py-3 text-left">Parts</th><th className="px-3 py-3 text-right">Jumlah</th><th className="px-3 py-3 text-right">Harga</th><th className="px-3 py-3 text-right">Diskon</th><th className="px-3 py-3 text-right">Subtotal</th><th className="px-3 py-3 text-left">Keterangan</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{partRows.map((row, index) => <tr key={index}><td className="px-3 py-3">{row.name}</td><td className="px-3 py-3 text-right">{row.qty}</td><td className="px-3 py-3 text-right">{formatRupiah(row.price)}</td><td className="px-3 py-3 text-right">{formatRupiah(row.discount)}</td><td className="px-3 py-3 text-right">{formatRupiah(row.qty * row.price - row.discount)}</td><td className="px-3 py-3">{row.description || '-'}</td></tr>)}</tbody></table></div>
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3 dark:bg-slate-900"><div className="font-semibold">Subtotal: {formatRupiah(partSubtotal)}</div><Field label="Diskon"><Input type="number" min="0" value={estimatedPartDiscount} onChange={(e) => updatePartAmount(e.target.value)} /></Field><Field label="Diskon (%)"><Input type="number" min="0" max="100" value={partDiscountPercent} onChange={(e) => updatePartPercent(e.target.value)} /></Field></div>
            </section>
            <div className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:grid-cols-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div><p className="text-sm text-emerald-800 dark:text-emerald-300">Estimasi Total Biaya</p><p className="mt-1 text-2xl font-bold text-emerald-700">{formatRupiah(total)}</p></div>
                <div className="grid grid-cols-2 gap-3"><Field label="Saldo Deposit"><Input type="number" min="0" value={data.estimate.depositBalance} onChange={(e) => setEstimate('depositBalance', e.target.value)} /></Field><Field label="Total DP"><Input type="number" min="0" value={data.estimate.totalDownPayment} onChange={(e) => setEstimate('totalDownPayment', e.target.value)} /></Field></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Estimasi Lama Pengerjaan (Menit)"><Input type="number" min="0" value={data.estimate.estimatedMinutes} onChange={(e) => setEstimate('estimatedMinutes', e.target.value)} /></Field>
                <Field label="Jam Pendaftaran"><Input type="time" value={data.estimate.registrationTime} onChange={(e) => setEstimate('registrationTime', e.target.value)} /></Field>
                <Field label="Estimasi Jam Pengerjaan"><Input type="time" value={startTime} onChange={(e) => setEstimate('startTime', e.target.value)} /></Field>
                <Field label="Estimasi Jam Selesai"><Input type="time" value={estimatedFinish} readOnly /></Field>
                <div className="md:col-span-2"><span className="mb-1.5 block text-sm font-medium">Status Tunggu</span><div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">{['ditunggu', 'ditinggal'].map((mode) => <button type="button" key={mode} onClick={() => setEstimate('waitingMode', mode)} className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize ${data.estimate.waitingMode === mode ? 'bg-slate-900 text-white dark:bg-slate-700' : 'text-slate-600'}`}>{mode}</button>)}</div></div>
                <button type="button" className="mt-6 rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700">+ Transfer Deposit</button>
            </div>
        </div>
    );
}

export function BookingStep({ data, setData }) {
    const setBooking = (key, value) => setData((current) => ({ ...current, booking: { ...current.booking, [key]: value } }));
    return (
        <div className="space-y-4">
            {data.booking.found ? <div className="grid gap-4 rounded-2xl border border-slate-200 p-5 md:grid-cols-2 dark:border-slate-800"><Field label="Nomor Booking"><Input value={data.booking.bookingNumber} onChange={(e) => setBooking('bookingNumber', e.target.value)} /></Field><Field label="Tanggal Booking"><Input type="date" value={data.booking.date} onChange={(e) => setBooking('date', e.target.value)} /></Field><Field label="Nama Pelanggan"><Input value={data.booking.customerName} onChange={(e) => setBooking('customerName', e.target.value)} /></Field><Field label="No Handphone"><Input value={data.booking.phone} onChange={(e) => setBooking('phone', e.target.value)} /></Field><Field label="Catatan" className="md:col-span-2"><textarea className={inputClass} value={data.booking.notes} onChange={(e) => setBooking('notes', e.target.value)} /></Field></div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700"><p className="font-semibold text-slate-700 dark:text-slate-200">Tidak ada informasi booking</p><p className="mt-1 text-sm text-slate-500">PKB tetap dapat diselesaikan tanpa booking.</p></div>}
        </div>
    );
}

export default function PkbCreateForm({
    initialValue = {},
    mode = 'create',
    saving = false,
    onSave,
    onSaveAndPrint,
    onPrint,
}) {
    const [activeStep, setActiveStep] = useState(0);
    const [data, setData] = useState(() => initialData(initialValue));
    const [errors, setErrors] = useState({});

    useEffect(() => {
        setData(initialData(initialValue));
    }, [initialValue]);

    useEffect(() => {
        setData((current) => {
            if (!current.carrier.sameAsOwner) return current;
            return {
                ...current,
                carrier: {
                    ...current.carrier,
                    name: current.owner.name,
                    address: current.owner.address,
                    phone1: current.owner.phone1,
                    phone2: current.owner.phone2,
                    province: current.owner.province,
                    city: current.owner.city,
                    district: current.owner.district,
                    village: current.owner.village,
                },
            };
        });
    }, [data.owner, data.carrier.sameAsOwner]);

    const steps = [
        { title: 'Data Kendaraan', component: VehicleStep },
        { title: 'Data Konsumen', component: ConsumerStep },
        { title: 'LCR', component: LcrStep },
        { title: 'Riwayat Service', component: ServiceHistoryStep },
        { title: 'Suggest Pekerjaan', component: SuggestionStep },
        { title: 'CAD', component: CadStep },
        { title: 'Pekerjaan', component: JobsStep },
        { title: 'Estimasi', component: EstimateStep },
        { title: 'Info Booking', component: BookingStep },
    ];

    const collectErrors = (step) => {
        const nextErrors = {};
        (requiredFields[step] || []).forEach(([path, label]) => {
            if (getPath(data, path) === '' || getPath(data, path) === null || getPath(data, path) === undefined) {
                nextErrors[path] = `${label} wajib diisi`;
            }
        });
        if (step === 2) {
            if (!data.lcr.customerAvailability) nextErrors['lcr.customerAvailability'] = 'Kesediaan Customer Check wajib dipilih';
            if (!data.lcr.rejectionReason) nextErrors['lcr.rejectionReason'] = 'Alasan Tidak Bersedia wajib dipilih';
            if (!data.lcr.inspectionResult) nextErrors['lcr.inspectionResult'] = 'Hasil Pengecekan wajib dipilih';
        }
        return nextErrors;
    };

    const validateStep = (step) => {
        const nextErrors = collectErrors(step);
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    // Temuan 9.2 — saat submit, validasi semua langkah yang punya field
    // wajib (0 kendaraan, 1 pemilik/pembawa, 2 LCR), bukan hanya langkah
    // yang sedang aktif. Kalau ada yang kosong, lompat ke langkah pertama
    // yang bermasalah supaya user langsung melihat field-nya.
    const validateAllSteps = () => {
        const allErrors = {};
        let firstInvalidStep = null;
        [0, 1, 2].forEach((step) => {
            const stepErrors = collectErrors(step);
            if (Object.keys(stepErrors).length > 0 && firstInvalidStep === null) firstInvalidStep = step;
            Object.assign(allErrors, stepErrors);
        });
        setErrors(allErrors);
        if (firstInvalidStep !== null) setActiveStep(firstInvalidStep);
        return Object.keys(allErrors).length === 0;
    };

    const applySuggestionsToJobs = () => {
        const selected = (data.suggestions || []).filter((item) => item.selected);
        if (!selected.length) return;
        setData((current) => ({
            ...current,
            jobs: [
                ...current.jobs,
                ...selected.map((item) => ({
                    id: `suggestion-${item.id || item.name}-${Date.now()}`,
                    group: item.group || 'PAKET LENGKAP',
                    name: item.name,
                    discount: 0,
                    price: Number(item.price || 0),
                    flatRate: Number(item.flatRate || 0),
                    chargeTo: 'Customer',
                    recommended: true,
                    parts: item.parts || [],
                })),
            ],
        }));
    };

    const goNext = () => {
        if (!validateStep(activeStep)) return;
        if (activeStep === 4) applySuggestionsToJobs();
        setActiveStep((current) => Math.min(steps.length - 1, current + 1));
    };

    const submitPkb = () => {
        if (saving) return;
        if (!validateAllSteps()) return;
        onSave?.(data, mode);
    };

    const ActiveComponent = steps[activeStep].component;

    return (
        <div className="space-y-5">
            <nav className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950" aria-label="Langkah Create or Edit PKB">
                <ol className="flex min-w-max gap-1">
                    {steps.map((step, index) => (
                        <li key={step.title}>
                            <button type="button" onClick={() => setActiveStep(index)}
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${index === activeStep ? 'bg-emerald-600 text-white shadow-sm' : index < activeStep ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'}`}>
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${index === activeStep ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{index < activeStep ? <IconCheck size={12} /> : index + 1}</span>
                                {step.title}
                            </button>
                        </li>
                    ))}
                </ol>
            </nav>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-5 flex items-center justify-between">
                    <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Langkah {activeStep + 1}</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{mode === 'edit' ? 'Edit' : 'Create'} PKB - {steps[activeStep].title}</h2></div>
                    {activeStep === 5 && <button type="button" onClick={() => onSaveAndPrint?.(data, mode)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60 dark:border-slate-700"><IconPrinter size={16} /> {saving ? 'Menyimpan...' : 'Save and Print CAD'}</button>}
                    {activeStep === 7 && <div className="flex gap-2"><button type="button" onClick={() => onSaveAndPrint?.(data, mode)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-slate-700"><IconPrinter size={15} /> {saving ? 'Menyimpan...' : 'Save And Print Estimasi'}</button><button type="button" onClick={() => onSaveAndPrint?.(data, mode)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"><IconDeviceFloppy size={15} /> {saving ? 'Menyimpan...' : 'Save and Print PKB'}</button><button type="button" onClick={() => onPrint?.(data)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"><IconPrinter size={15} /></button></div>}
                </div>

                <ActiveComponent
                    data={data}
                    setData={setData}
                    errors={errors}
                    saving={saving}
                    onSavePrint={() => onSaveAndPrint?.(data, mode)}
                />

                {activeStep === 8 ? (
                    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                        <button type="button" onClick={() => setActiveStep((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700"><IconArrowLeft size={17} /> Back</button>
                        <button type="button" onClick={submitPkb} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><IconCheck size={17} /> {saving ? 'Menyimpan...' : 'Simpan / Selesai PKB'}</button>
                    </div>
                ) : (
                    <StepNavigation step={activeStep} total={steps.length} onBack={() => setActiveStep((current) => Math.max(0, current - 1))} onNext={goNext} />
                )}
            </div>
        </div>
    );
}
