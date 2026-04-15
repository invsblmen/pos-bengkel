# Architecture Boundary (Laravel Inertia vs GO)

Tanggal acuan: 2026-04-14

Dokumen ini menetapkan batas integrasi agar Laravel Inertia tidak memiliki coupling runtime ke GO backend atau GO frontend.

## Prinsip Utama

1. Laravel Inertia adalah aplikasi mandiri.
2. GO backend dan GO frontend adalah stack mandiri terpisah.
3. Integrasi lintas stack hanya lewat API sinkronisasi data GO -> Laravel.
4. Tidak ada dependensi runtime Laravel Inertia ke endpoint operasional GO untuk render halaman Inertia.

## Yang Diizinkan

1. Endpoint consumer sinkronisasi di Laravel:
   - `POST /api/sync/batches`
   - `GET /api/sync/status`
2. Scheduler/command sinkronisasi terkontrol untuk operasional backend.
3. Integrasi webhook yang memang domain terpisah (misalnya WhatsApp) selama tidak menjadi syarat render halaman inti workshop.

## Yang Tidak Diizinkan

1. Halaman Inertia memanggil GO backend secara langsung untuk data utama halaman.
2. Controller web Laravel fallback ke GO backend untuk response route dashboard.
3. Hook frontend Laravel yang memakai naming/endpoint/runtime khusus GO (`useGo*`, `VITE_GO_WS_*`, `new WebSocket(...)` ke GO).

## Panduan Realtime

1. Default: tanpa websocket jika tidak perlu update instan.
2. Jika perlu realtime di Laravel Inertia: gunakan stack native Laravel (Reverb/Echo/Pusher protocol compatible).
3. Realtime GO tetap milik aplikasi GO, tidak dipakai oleh Laravel Inertia.

## Definisi Selesai (Definition of Done)

1. Tidak ada import/hook runtime GO di `resources/js` untuk halaman Inertia.
2. Tidak ada route web yang bergantung HTTP bridge ke GO agar halaman bisa berfungsi.
3. Integrasi aktif lintas stack hanya melalui kontrak sinkronisasi API pada dokumen `SYNC_API_CONTRACT_V1.md`.
