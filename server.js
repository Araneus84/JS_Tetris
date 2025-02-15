const express = require('express');
const fs = require('fs');
const app = express();
const path = require('path');

app.use(express.static('./'));
app.use(express.json()); // Add body parser for JSON

const AI_DATA_FILE = 'ai-weights.json';

// Create weights directory if it doesn't exist
const weightsDir = path.dirname(AI_DATA_FILE);
if (!fs.existsSync(weightsDir)) {
    fs.mkdirSync(weightsDir, { recursive: true });
}
// Create initial weights file if it doesn't exist
if (!fs.existsSync(AI_DATA_FILE)) {
    const initialData = {
        weights: {
            heightWeight: -0.810066,
            linesWeight: 0.960666,
            holesWeight: -0.75663,
            bumpinessWeight: -0.484483,
            wallWeight: 0.25
        },
        generation: 0
    };
    fs.writeFileSync(AI_DATA_FILE, JSON.stringify(initialData));
}

app.get('/api/weights', (req, res) => {
    try {
        const weights = JSON.parse(fs.readFileSync(AI_DATA_FILE));
        res.json(weights);
    } catch (error) {
        console.error('Error reading weights:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    next();
});

app.post('/api/weights', (req, res) => {
    try {
        if (!req.body || !req.body.weights || !req.body.generation) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request body format'
            });
        }

        const fullPath = path.resolve(AI_DATA_FILE);
        const data = JSON.stringify(req.body, null, 2);
        fs.writeFileSync(fullPath, data);
        console.log('Weights saved to:', fullPath);
        res.json({ success: true });
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            path: AI_DATA_FILE
        });
    }
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});