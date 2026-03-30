
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { generatePdf } = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow Frontend to hit this API
app.use(bodyParser.json({ limit: '10mb' }));

// Routes
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { type, data, company, user } = req.body;

        if (!type || !data) {
            return res.status(400).send('Missing required fields: type or data');
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
});
