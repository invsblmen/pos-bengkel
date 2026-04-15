package httpserver

import (
	"fmt"
	"net/http"
	"strings"

	"posbengkel/go-backend/internal/config"
)

func goUIHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		base := strings.TrimRight(cfg.Address(), "/")
		if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
			base = "http://" + base
		}

		html := fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POS Bengkel GO Control Surface</title>
  <style>
    :root {
      --bg: #eef3f8;
      --panel: #ffffff;
      --ink: #0f2239;
      --muted: #566a84;
      --line: #d3deeb;
      --brand: #006d77;
      --brand-2: #124f88;
      --brand-soft: #d7eef0;
      --ok: #14804a;
      --warn: #9a6700;
      --bad: #b42318;
      --mono: "Consolas", "SFMono-Regular", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12%% 0%%, #cfe9e3 0%%, transparent 28%%),
        radial-gradient(circle at 94%% 100%%, #cfe0fa 0%%, transparent 34%%),
        var(--bg);
    }
    .wrap {
      max-width: 1140px;
      margin: 0 auto;
      padding: 28px 18px 40px;
    }
    .hero {
      background: linear-gradient(125deg, #103257, #1f5e95 60%%, #006d77);
      color: #f6fbff;
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 18px 35px rgba(12, 34, 59, 0.22);
    }
    .hero h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 0.015em;
    }
    .hero p {
      margin: 8px 0 0;
      color: #d4e5f6;
      font-size: 14px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .chip {
      padding: 7px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid rgba(219, 236, 255, 0.4);
      background: rgba(255, 255, 255, 0.08);
    }
    .grid {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 10px 24px rgba(11, 28, 50, 0.08);
    }
    .panel h2 {
      margin: 0 0 10px;
      font-size: 14px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .status {
      font-size: 22px;
      font-weight: 700;
      margin: 2px 0;
    }
    .ok { color: var(--ok); }
    .warn { color: var(--warn); }
    .bad { color: var(--bad); }
    .list {
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }
    .list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 13px;
      background: #f9fbff;
    }
    .list a {
      color: #185892;
      text-decoration: none;
      font-weight: 600;
    }
    .list a:hover { text-decoration: underline; }
    .actions {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn.primary {
      border-color: #0b7b70;
      background: var(--brand);
      color: #f4fffd;
    }
    .btn.secondary {
      border-color: #225f95;
      background: var(--brand-2);
      color: #f0f7ff;
    }
    .log {
      margin-top: 14px;
      border-radius: 12px;
      border: 1px solid #d0dbe8;
      background: #0f2136;
      color: #d6e5f6;
      padding: 12px;
      min-height: 120px;
      font-size: 12px;
      line-height: 1.5;
      overflow: auto;
      white-space: pre-wrap;
      font-family: var(--mono);
    }
    .stack {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 12px;
    }
    .domain-nav {
      display: grid;
      gap: 8px;
    }
    .domain-btn {
      text-align: left;
      border: 1px solid var(--line);
      background: #fbfdff;
      color: var(--ink);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .domain-btn.active {
      border-color: #8cc8ce;
      background: var(--brand-soft);
      color: #004e57;
    }
    .endpoint-table {
      width: 100%%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .endpoint-table th,
    .endpoint-table td {
      border-bottom: 1px solid #e2e9f2;
      padding: 9px 8px;
      text-align: left;
      vertical-align: top;
    }
    .endpoint-table th {
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .method {
      display: inline-flex;
      min-width: 52px;
      justify-content: center;
      border-radius: 999px;
      font-size: 11px;
      padding: 3px 8px;
      font-weight: 700;
      border: 1px solid #bfd3ec;
      background: #edf5ff;
      color: #174f88;
    }
    .method.post,
    .method.put,
    .method.patch,
    .method.delete {
      border-color: #95d6cc;
      background: #e7f6f3;
      color: #0f6559;
    }
    .tester-form {
      margin-top: 10px;
      display: grid;
      gap: 8px;
    }
    .row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      gap: 8px;
    }
    label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      align-self: center;
    }
    select,
    input,
    textarea {
      width: 100%%;
      border: 1px solid #c9d6e6;
      border-radius: 10px;
      padding: 9px 10px;
      font-size: 13px;
      color: var(--ink);
      background: #fff;
      font-family: inherit;
    }
    textarea {
      min-height: 92px;
      resize: vertical;
      font-family: var(--mono);
      font-size: 12px;
    }
    .hint {
      margin-top: 4px;
      font-size: 12px;
      color: var(--muted);
    }
    @media (max-width: 920px) {
      .grid { grid-template-columns: 1fr; }
      .stack { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; }
      .hero h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>POS Bengkel GO Control Surface</h1>
      <p>UI lightweight langsung dari service Go untuk cek kondisi API, endpoint inti, dan health probe.</p>
      <div class="chips">
        <div class="chip">Service: %s</div>
        <div class="chip">Base URL: %s</div>
        <div class="chip">Mode: API + Native UI</div>
        <div class="chip">Subscribers: <span id="subscribers-total">0</span></div>
      </div>
    </section>

    <section class="grid">
      <article class="panel">
        <h2>Health</h2>
        <div id="health-status" class="status warn">Checking...</div>
        <div id="health-detail" style="font-size:13px;color:var(--muted)">Waiting for probe result</div>
      </article>
      <article class="panel">
        <h2>Ready</h2>
        <div id="ready-status" class="status warn">Checking...</div>
        <div id="ready-detail" style="font-size:13px;color:var(--muted)">Waiting for probe result</div>
      </article>
      <article class="panel">
        <h2>Live</h2>
        <div id="live-status" class="status warn">Checking...</div>
        <div id="live-detail" style="font-size:13px;color:var(--muted)">Waiting for probe result</div>
      </article>
    </section>

    <section class="panel" style="margin-top:12px;">
      <h2>Domain Endpoint Explorer</h2>
      <div class="stack">
        <div class="domain-nav" id="domain-nav"></div>
        <div>
          <div class="hint" id="domain-description">Choose a domain to inspect endpoint list.</div>
          <table class="endpoint-table" id="endpoint-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody id="endpoint-body"></tbody>
          </table>
        </div>
      </div>

      <h2 style="margin-top:14px;">Quick Endpoints</h2>
      <ul class="list">
        <li><a href="/health" target="_blank">GET /health</a><span>service health check</span></li>
        <li><a href="/ready" target="_blank">GET /ready</a><span>readiness probe</span></li>
        <li><a href="/live" target="_blank">GET /live</a><span>liveness probe</span></li>
        <li><a href="/api/v1/realtime/subscribers" target="_blank">GET /api/v1/realtime/subscribers</a><span>live subscriber stats</span></li>
        <li><a href="/api/v1/reports/overall" target="_blank">GET /api/v1/reports/overall</a><span>overall report payload</span></li>
        <li><a href="/api/v1/sync/status" target="_blank">GET /api/v1/sync/status</a><span>sync status payload</span></li>
      </ul>

      <h2 style="margin-top:14px;">Request Tester</h2>
      <div class="tester-form">
        <div class="row">
          <label for="req-method">Method</label>
          <select id="req-method">
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
        </div>
        <div class="row">
          <label for="req-path">Path</label>
          <input id="req-path" value="/health" />
        </div>
        <div class="row">
          <label for="req-body">JSON Body</label>
          <textarea id="req-body" placeholder="{\n  \"example\": true\n}"></textarea>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary" id="btn-refresh">Refresh Probe</button>
        <button class="btn" id="btn-json-health">Show /health JSON</button>
        <button class="btn" id="btn-json-sync">Show /api/v1/sync/status JSON</button>
        <button class="btn secondary" id="btn-send-request">Send Custom Request</button>
        <button class="btn secondary" id="btn-ws-toggle" style="background:#9a6700;border-color:#854d02">Connect WebSocket</button>
      </div>
      <div id="ws-section" style="display:none;margin-top:12px;padding:12px;border:1px solid #d6c599;border-radius:10px;background:#fffbf0">
        <div style="font-size:12px;color:#5a4a30;margin-bottom:8px">
          <strong>Real-time Events</strong>
          <span id="ws-status" style="margin-left:8px;padding:3px 6px;border-radius:6px;background:#e6d4b8;font-size:11px">Disconnected</span>
        </div>
        <div class="hint">Subscribe to domains for real-time updates (service order changes, sync events, etc)</div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          <label style="margin:0;align-self:center;width:auto;letter-spacing:0">Subscribe to:</label>
          <input type="checkbox" id="ws-sub-service_orders" value="service_orders" /> Service Orders
          <input type="checkbox" id="ws-sub-appointments" value="appointments" /> Appointments
          <input type="checkbox" id="ws-sub-sync" value="sync" /> Sync Events
          <input type="checkbox" id="ws-sub-reports" value="reports" /> Reports
        </div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <label style="margin:0;align-self:center;width:auto;letter-spacing:0" for="ws-token">WS Token (optional):</label>
          <input id="ws-token" placeholder="GO_WS_TOKEN value" style="max-width:260px" />
        </div>
      </div>
      <div class="log" id="log-box">Output will appear here...</div>
    </section>
  </div>

  <script>
    let wsConn = null;
    let wsReconnectTimer = null;
    let subscribedDomains = [];

    const endpointDomains = [
      {
        key: 'core',
        label: 'Core Probes',
        description: 'Probe endpoint dasar untuk status service dan kesiapan runtime.',
        items: [
          { method: 'GET', path: '/health', note: 'service health check' },
          { method: 'GET', path: '/ready', note: 'readiness probe' },
          { method: 'GET', path: '/live', note: 'liveness probe' }
        ]
      },
      {
        key: 'sync',
        label: 'Sync',
        description: 'Endpoint sinkronisasi Go -> Laravel untuk monitoring batch dan eksekusi retry.',
        items: [
          { method: 'GET', path: '/api/v1/sync/status', note: 'current sync state' },
          { method: 'GET', path: '/api/v1/sync/batches', note: 'list batch sync' },
          { method: 'POST', path: '/api/v1/sync/run', note: 'run sync pipeline' }
        ]
      },
      {
        key: 'reports',
        label: 'Reports',
        description: 'Ringkasan report domain bengkel untuk monitoring operasional harian.',
        items: [
          { method: 'GET', path: '/api/v1/reports/overall', note: 'overall KPI + transactions' },
          { method: 'GET', path: '/api/v1/reports/part-sales-profit', note: 'profit report' },
          { method: 'GET', path: '/api/v1/reports/outstanding-payments', note: 'pending payment report' }
        ]
      },
      {
        key: 'workshop',
        label: 'Workshop',
        description: 'Endpoint inti operasional service order dan appointment.',
        items: [
          { method: 'GET', path: '/api/v1/service-orders', note: 'service order index' },
          { method: 'GET', path: '/api/v1/appointments', note: 'appointment index' },
          { method: 'GET', path: '/api/v1/parts/low-stock', note: 'critical stock list' }
        ]
      }
    ];

    const setState = (prefix, ok, text) => {
      const el = document.getElementById(prefix + '-status');
      const detail = document.getElementById(prefix + '-detail');
      if (!el || !detail) return;
      el.textContent = ok ? 'OK' : 'FAILED';
      el.className = 'status ' + (ok ? 'ok' : 'bad');
      detail.textContent = text;
    };

    const writeLog = (title, body) => {
      const box = document.getElementById('log-box');
      const at = new Date().toLocaleString();
      box.textContent = '[' + at + '] ' + title + '\n' + body;
    };

    const renderDomain = (domainKey) => {
      const nav = document.getElementById('domain-nav');
      const body = document.getElementById('endpoint-body');
      const desc = document.getElementById('domain-description');
      const selected = endpointDomains.find(d => d.key === domainKey) || endpointDomains[0];

      nav.innerHTML = '';
      endpointDomains.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'domain-btn' + (d.key === selected.key ? ' active' : '');
        btn.textContent = d.label;
        btn.addEventListener('click', () => renderDomain(d.key));
        nav.appendChild(btn);
      });

      desc.textContent = selected.description;
      body.innerHTML = '';

      selected.items.forEach(item => {
        const tr = document.createElement('tr');

        const tdMethod = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'method ' + item.method.toLowerCase();
        badge.textContent = item.method;
        tdMethod.appendChild(badge);

        const tdPath = document.createElement('td');
        const pathLink = document.createElement('a');
        pathLink.href = item.path;
        pathLink.target = '_blank';
        pathLink.textContent = item.path;
        pathLink.style.color = '#184f83';
        pathLink.style.fontWeight = '700';
        pathLink.style.textDecoration = 'none';
        tdPath.appendChild(pathLink);

        const tdNote = document.createElement('td');
        tdNote.textContent = item.note;

        tr.appendChild(tdMethod);
        tr.appendChild(tdPath);
        tr.appendChild(tdNote);
        body.appendChild(tr);
      });
    };

    const probe = async (path, prefix) => {
      try {
        const res = await fetch(path, { headers: { 'Accept': 'application/json' } });
        const text = await res.text();
        setState(prefix, res.ok, 'HTTP ' + res.status);
        return text;
      } catch (err) {
        setState(prefix, false, err.message || 'request failed');
        return '';
      }
    };

    const runProbe = async () => {
      await Promise.all([
        probe('/health', 'health'),
        probe('/ready', 'ready'),
        probe('/live', 'live')
      ]);
    };

    const updateWSStatus = (connected, msg) => {
      const el = document.getElementById('ws-status');
      const sect = document.getElementById('ws-section');
      if (!el || !sect) return;

      if (connected) {
        el.textContent = '● Connected';
        el.style.background = '#c8e6c9';
        el.style.color = '#2e7d32';
        sect.style.display = 'block';
      } else {
        el.textContent = '○ ' + (msg || 'Disconnected');
        el.style.background = '#ffcccc';
        el.style.color = '#c62828';
        sect.style.display = 'none';
      }
    };

    const wsConnect = () => {
      if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        writeLog('WebSocket', 'Already connected');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = (document.getElementById('ws-token')?.value || '').trim();
      const wsUrl = protocol + '//' + window.location.host + '/ws' + (token ? ('?token=' + encodeURIComponent(token)) : '');

      try {
        wsConn = new WebSocket(wsUrl);

        wsConn.onopen = () => {
          writeLog('WebSocket', 'Connected to ' + wsUrl);
          updateWSStatus(true);
          clearTimeout(wsReconnectTimer);
        };

        wsConn.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const eventType = msg.type || 'unknown';
            const at = new Date().toLocaleTimeString();

            const eventAction = (msg.action || '').toLowerCase();

            // Auto-trigger probe for lifecycle/status events
            if (
              eventType.indexOf('_changed') > -1 ||
              eventType.indexOf('_completed') > -1 ||
              eventAction === 'created' ||
              eventAction === 'updated' ||
              eventAction === 'deleted' ||
              eventAction === 'items_changed'
            ) {
              runProbe();
            }

            writeLog('[Real-time ' + at + '] ' + eventType,
              'Domain: ' + (msg.domain || 'N/A') + '\n' +
              'ID: ' + (msg.id || 'N/A') + '\n' +
              'Action: ' + (msg.action || 'N/A') + '\n' +
              JSON.stringify((() => {
                if (!msg.data) return {};
                if (typeof msg.data === 'string') {
                  try { return JSON.parse(msg.data); } catch (_) { return { raw: msg.data }; }
                }
                return msg.data;
              })(), null, 2));
          } catch (e) {
            writeLog('WebSocket Message Error', e.message);
          }
        };

        wsConn.onerror = (err) => {
          writeLog('WebSocket Error', err.message || 'Connection error');
          updateWSStatus(false, 'Error');
        };

        wsConn.onclose = () => {
          updateWSStatus(false, 'Closed');
          // Attempt reconnect in 5 seconds
          wsReconnectTimer = setTimeout(wsConnect, 5000);
        };

      } catch (err) {
        writeLog('WebSocket Init Error', err.message);
        updateWSStatus(false, 'Failed');
      }
    };

    const wsSubscribe = (domains) => {
      if (!wsConn || wsConn.readyState !== WebSocket.OPEN) {
        writeLog('WebSocket', 'Not connected, cannot subscribe');
        return;
      }

      const msg = {
        type: 'subscribe',
        domains: domains
      };

      wsConn.send(JSON.stringify(msg));
      subscribedDomains = domains;
      writeLog('WebSocket Subscribe', 'Subscribed to: ' + domains.join(', '));
    };

    const updateSubscriptions = () => {
      const domains = [];
      document.querySelectorAll('[id^="ws-sub-"]').forEach(cb => {
        if (cb.checked) domains.push(cb.value);
      });

      if (domains.length === 0) {
        writeLog('Subscriptions', 'No domains selected');
        return;
      }

      wsSubscribe(domains);
    };

    const refreshSubscriberStats = async () => {
      try {
        const res = await fetch('/api/v1/realtime/subscribers', { headers: { 'Accept': 'application/json' } });
        const payload = await res.json();
        const total = payload.total_clients ?? 0;
        const totalEl = document.getElementById('subscribers-total');
        if (totalEl) {
          totalEl.textContent = String(total);
        }
      } catch (_) {
        const totalEl = document.getElementById('subscribers-total');
        if (totalEl) {
          totalEl.textContent = 'n/a';
        }
      }
    };

    // WebSocket button handlers
    document.getElementById('btn-ws-toggle').addEventListener('click', () => {
      if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        wsConn.close();
        updateWSStatus(false, 'Closed by user');
        writeLog('WebSocket', 'Closed connection');
      } else {
        writeLog('WebSocket', 'Connecting...');
        wsConnect();
      }
      refreshSubscriberStats();
    });

    document.querySelectorAll('[id^="ws-sub-"]').forEach(cb => {
      cb.addEventListener('change', updateSubscriptions);
    });

    document.getElementById('btn-refresh').addEventListener('click', async () => {
      await runProbe();
      writeLog('Probe', 'Completed health, ready, and live checks.');
    });

    document.getElementById('btn-json-health').addEventListener('click', async () => {
      const text = await probe('/health', 'health');
      writeLog('/health', text || '(empty response)');
    });

    document.getElementById('btn-json-sync').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/v1/sync/status', { headers: { 'Accept': 'application/json' } });
        const text = await res.text();
        writeLog('/api/v1/sync/status', 'HTTP ' + res.status + '\n' + text);
      } catch (err) {
        writeLog('/api/v1/sync/status', err.message || 'request failed');
      }
    });

    document.getElementById('btn-send-request').addEventListener('click', async () => {
      const method = document.getElementById('req-method').value;
      const path = document.getElementById('req-path').value || '/health';
      const bodyText = document.getElementById('req-body').value.trim();

      const init = {
        method,
        headers: { 'Accept': 'application/json' }
      };

      if (bodyText && method !== 'GET' && method !== 'DELETE') {
        init.headers['Content-Type'] = 'application/json';
        init.body = bodyText;
      }

      try {
        const res = await fetch(path, init);
        const text = await res.text();
        writeLog(method + ' ' + path, 'HTTP ' + res.status + '\n' + text);
      } catch (err) {
        writeLog(method + ' ' + path, err.message || 'request failed');
      }
    });

    renderDomain('core');
    runProbe();
    refreshSubscriberStats();
    setInterval(refreshSubscriberStats, 10000);
  </script>
</body>
</html>`, cfg.AppName, base)

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(html))
	}
}
