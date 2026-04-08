const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// JSON file as database
const DATA_FILE = path.join(__dirname, 'submissions.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ submissions: [], nextId: 1 }, null, 2));
}

// Helper functions
function readData() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ========== PUBLIC ENDPOINTS ==========

// Get stats
app.get('/api/stats', (req, res) => {
    const data = readData();
    const verified = data.submissions.filter(s => s.verified === 1).length;
    res.json({
        total_submissions: data.submissions.length,
        verified_contacts: verified,
        target: 500
    });
});

// Submit contact
app.post('/api/submit', (req, res) => {
    const { name, phone } = req.body;
    
    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }
    
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone format. Use +1234567890' });
    }
    
    const data = readData();
    
    const exists = data.submissions.find(s => s.phone === phone);
    if (exists) {
        return res.status(400).json({ error: 'This phone number has already been submitted' });
    }
    
    const newSubmission = {
        id: data.nextId++,
        name,
        phone,
        verified: 0,
        submitted_at: new Date().toISOString()
    };
    
    data.submissions.push(newSubmission);
    writeData(data);
    
    const verifiedCount = data.submissions.filter(s => s.verified === 1).length;
    res.json({ 
        success: true, 
        message: 'Submitted successfully!',
        verified_count: verifiedCount
    });
});

// ========== ADMIN ENDPOINTS ==========

const checkAdmin = (req, res, next) => {
    const passkey = req.headers['x-admin-passkey'] || req.query.passkey;
    const adminPasskey = process.env.ADMIN_PASSKEY || 'darkheart';
    
    if (passkey === adminPasskey) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Get all submissions
app.get('/api/admin/submissions', checkAdmin, (req, res) => {
    const data = readData();
    res.json(data.submissions);
});

// Get admin stats
app.get('/api/admin/stats', checkAdmin, (req, res) => {
    const data = readData();
    const verified = data.submissions.filter(s => s.verified === 1).length;
    res.json({
        total: data.submissions.length,
        verified: verified,
        pending: data.submissions.length - verified
    });
});

// Verify a contact
app.put('/api/admin/verify/:id', checkAdmin, (req, res) => {
    const { id } = req.params;
    const data = readData();
    
    const submission = data.submissions.find(s => s.id === parseInt(id));
    if (submission) {
        submission.verified = 1;
        writeData(data);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Delete a contact
app.delete('/api/admin/delete/:id', checkAdmin, (req, res) => {
    const { id } = req.params;
    const data = readData();
    
    data.submissions = data.submissions.filter(s => s.id !== parseInt(id));
    writeData(data);
    res.json({ success: true });
});

// Generate VCF file
app.get('/api/admin/generate-vcf', checkAdmin, (req, res) => {
    const data = readData();
    const verified = data.submissions.filter(s => s.verified === 1);
    
    let vcfContent = '';
    verified.forEach(contact => {
        vcfContent += `BEGIN:VCARD\n`;
        vcfContent += `VERSION:3.0\n`;
        vcfContent += `FN:${contact.name}\n`;
        vcfContent += `TEL:${contact.phone}\n`;
        vcfContent += `END:VCARD\n`;
    });
    
    res.setHeader('Content-Type', 'text/vcard');
    res.setHeader('Content-Disposition', 'attachment; filename=quantix-contacts.vcf');
    res.send(vcfContent);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 QUANTIX TECH Server running on http://localhost:${PORT}`);
    console.log(`📁 Data saved to: ${DATA_FILE}`);
});
