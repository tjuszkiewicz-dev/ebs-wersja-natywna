
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { generatePdf, generateRawPdf } = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3015;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3010', 'http://localhost:3011'];

app.use(helmet());

const pdfLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 30,
    message: 'Too many PDF requests, please try again later.',
});

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
}));

app.use(bodyParser.json({ limit: '10mb' }));

const ALLOWED_TYPES = ['DEBIT_NOTE', 'VAT_INVOICE', 'BUYBACK_AGREEMENT', 'IMPORT_REPORT', 'PROTOCOL'];

// Routes

// Raw HTML → PDF (używany przez documentService.ts)
app.post('/api/generate-pdf-raw', pdfLimiter, async (req, res) => {
    try {
        const { html, pdfOptions } = req.body;
        if (!html || typeof html !== 'string') {
            return res.status(400).send('Missing required field: html');
        }

        // Whitelist safe PDF options only (no path/filesystem keys)
        const safeOptions = {};
        if (pdfOptions && typeof pdfOptions === 'object' && !Array.isArray(pdfOptions)) {
            const allowed = ['displayHeaderFooter', 'headerTemplate', 'footerTemplate', 'margin'];
            for (const key of allowed) {
                if (key in pdfOptions) safeOptions[key] = pdfOptions[key];
            }
        }

        const pdfBuffer = await generateRawPdf(html, safeOptions);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
        });
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[PDF Engine] Error (raw):', error);
        res.status(500).send('Error generating PDF');
    }
});

app.post('/api/generate-pdf', pdfLimiter, async (req, res) => {
    try {
        const { type, data, company, user } = req.body;

        if (!type || !data) {
            return res.status(400).send('Missing required fields: type or data');
        }

        if (!ALLOWED_TYPES.includes(type)) {
            return res.status(400).send(`Invalid document type: ${type}`);
        }

        console.log(`[PDF Engine] Generating document: ${type} for ID: ${data.id}`);

        const pdfBuffer = await generatePdf(type, data, company, user);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': `attachment; filename="${type}_${data.id}.pdf"`,
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('[PDF Engine] Error:', error);
        res.status(500).send('Error generating PDF');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`[PDF Engine] Server running on http://localhost:${PORT}`);
    console.log(`[PDF Engine] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
