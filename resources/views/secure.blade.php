<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Page - POS Bengkel</title>
    <style>
        :root {
            --bg: #f3f7fb;
            --card: #ffffff;
            --text: #0f172a;
            --muted: #475569;
            --accent: #0f766e;
            --accent-soft: #ccfbf1;
            --border: #dbeafe;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            color: var(--text);
            background:
                radial-gradient(circle at 10% 20%, #dbeafe 0, transparent 40%),
                radial-gradient(circle at 90% 80%, #bae6fd 0, transparent 35%),
                var(--bg);
            display: grid;
            place-items: center;
            padding: 24px;
        }

        .card {
            width: min(680px, 100%);
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 28px;
            box-shadow: 0 10px 30px rgba(2, 132, 199, 0.12);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
            color: var(--accent);
            background: var(--accent-soft);
            border-radius: 999px;
            padding: 6px 12px;
            margin-bottom: 14px;
        }

        h1 {
            margin: 0 0 10px;
            font-size: clamp(26px, 4vw, 36px);
            line-height: 1.15;
            letter-spacing: -0.02em;
        }

        p {
            margin: 0 0 10px;
            color: var(--muted);
            line-height: 1.65;
        }

        .meta {
            margin-top: 18px;
            padding-top: 16px;
            border-top: 1px dashed var(--border);
            font-size: 14px;
        }

        code {
            color: #155e75;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <main class="card">
        <div class="badge">SSL Active</div>
        <h1>Halaman Secure Aktif</h1>
        <p>Aplikasi POS Bengkel berhasil diakses melalui koneksi HTTPS.</p>
        <p>Jika Anda melihat halaman ini, artinya konfigurasi domain Herd untuk <code>pos-bengkel.test</code> sudah berjalan aman.</p>

        <div class="meta">
            URL saat ini: <code>{{ request()->getSchemeAndHttpHost() }}</code>
        </div>
    </main>
</body>
</html>
