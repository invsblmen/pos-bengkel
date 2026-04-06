# Learning Path 1 Jam - Go WhatsApp Multidevice

Tujuan: dalam 1 jam Anda paham alur end-to-end dan siap tambah fitur kecil dengan aman.

## 0-10 Menit: Pahami Startup
1. Baca `src/main.go`.
2. Baca `src/cmd/root.go` fokus ke `initEnvConfig()` dan `initApp()`.
3. Baca `src/cmd/rest.go` dan `src/cmd/mcp.go` untuk lihat perbedaan mode jalan.

Checklist:
- Tahu entrypoint aplikasi.
- Tahu kapan usecase dan infra diinisialisasi.
- Tahu REST dan MCP tidak dijalankan bersamaan.

## 10-25 Menit: Ikuti Satu Flow Nyata (Send Text)
1. Baca route di `src/ui/rest/send.go` (`/send/message`).
2. Baca validasi di `src/validations/send_validation.go`.
3. Baca usecase di `src/usecase/send.go` (fungsi `SendText`).
4. Lihat DTO di `src/domains/send/send.go`.

Checklist:
- Paham request masuk dari handler ke usecase.
- Paham kenapa `phone` harus format internasional (`62...`, bukan `08...`).
- Paham titik error `400` berasal dari validasi.

## 25-40 Menit: Pahami Multi-Device (Bagian Paling Penting)
1. Baca `src/infrastructure/whatsapp/device_manager.go`.
2. Baca `src/infrastructure/whatsapp/device_instance.go`.
3. Baca `src/infrastructure/whatsapp/context_device.go`.
4. Baca `src/infrastructure/whatsapp/event_handler.go`.

Checklist:
- Paham bedanya `device ID` vs `JID`.
- Paham semua operasi chat/message harus terscope per device.
- Paham context device dipakai supaya request tidak nyasar device.

## 40-50 Menit: Pahami Storage & Migrasi
1. Baca `src/infrastructure/chatstorage/sqlite_repository.go`.
2. Cari bagian `getMigrations()`.
3. Baca `src/infrastructure/chatstorage/device_repository.go`.
4. Baca `src/infrastructure/whatsapp/chatstorage_wrapper.go`.

Checklist:
- Paham migrasi bersifat append-only.
- Paham wrapper repository harus sinkron bila interface berubah.
- Paham anti-pattern: query tanpa `device_id`.

## 50-60 Menit: Coba Tugas Mini (Practice)
Tugas mini: tambah 1 endpoint baru untuk health/debug sederhana.

Langkah:
1. Tambah handler di `src/ui/rest/app.go` (misal `/app/ping`).
2. Tambah method kecil di `src/usecase/app.go` jika perlu.
3. Tambah validasi jika endpoint punya input.
4. Jalankan:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_rest.ps1
```
5. Uji endpoint dengan:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/app/ping" -UseBasicParsing
```

## Aturan Emas Saat Ngoding di Repo Ini
1. Selalu pikirkan scope `device_id` untuk data chats/messages.
2. Untuk nomor telepon, gunakan format internasional.
3. Jangan sisipkan migration di tengah, selalu append.
4. Jika ubah kontrak chatstorage, update kedua wrapper:
- `src/infrastructure/chatstorage/device_repository.go`
- `src/infrastructure/whatsapp/chatstorage_wrapper.go`
5. Letakkan business logic di `usecase`, bukan di `domains`.

## File Prioritas (Bookmark)
1. `src/cmd/root.go`
2. `src/ui/rest/send.go`
3. `src/usecase/send.go`
4. `src/validations/send_validation.go`
5. `src/infrastructure/whatsapp/device_manager.go`
6. `src/infrastructure/whatsapp/event_handler.go`
7. `src/infrastructure/chatstorage/sqlite_repository.go`

## Next Step Setelah 1 Jam
1. Tambah message type baru mengikuti pola 3-file:
- `src/domains/send/`
- `src/usecase/send.go`
- `src/validations/send_validation.go`
2. Mirror ke MCP jika fiturnya perlu dipakai AI tool:
- `src/ui/mcp/`
3. Tambah unit test minimal untuk validasi/usecase terkait.
