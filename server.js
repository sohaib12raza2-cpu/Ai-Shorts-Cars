import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

if (!process.env.LONGCAT_API_KEY) console.error("STARTUP ERROR: LONGCAT_API_KEY missing.");
if (!process.env.LONGCAT_BASE_URL) console.error("STARTUP ERROR: LONGCAT_BASE_URL missing.");
if (!process.env.LONGCAT_MODEL) console.error("STARTUP ERROR: LONGCAT_MODEL missing.");

app.use(cors());
app.use(express.json());

import generateHandler from './api/generate.js';

// Local Dev Proxy Endpoint 
// This acts purely as a local router to share the exact same serverless function that Vercel uses natively.
app.post('/api/generate', async (req, res) => {
    try {
        await generateHandler(req, res);
    } catch (e) {
        console.error('Local Express Dev Error:', e);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Local server encountered a routing issue.' });
        }
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
