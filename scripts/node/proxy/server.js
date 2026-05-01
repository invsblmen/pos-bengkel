const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');

const TARGET = process.env.TARGET_URL || 'https://sdmsdealer-h23.mpm-motor.com:22000';
const PORT = process.env.PORT || 3000;

const app = express();

app.use(morgan('dev'));
app.use(cors({ origin: true }));
app.use(express.json());

// Proxy any /api/* request to the target API
app.use('/api', createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  secure: false,
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    // If body is present, ensure it's forwarded
    if (req.body && Object.keys(req.body).length) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

app.get('/', (req, res) => res.send(`Proxy running — forwarding /api -> ${TARGET}`));

app.listen(PORT, () => {
  console.log(`SDMS proxy listening on http://localhost:${PORT} -> ${TARGET}`);
});
