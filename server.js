const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Root: serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin dashboard route
app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// JSON database
const DATA_FILE = path.join(__dirname, 'submissions.json');
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ submissions: [], nextId: 1 }, null, 2));
}

function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// Public endpoints
app.get('/api/stats', (req, res) => {
    const data = readData();
    const verified = data.submissions.filter(s => s.verified === 1).length;
    res.json({ total_submissions: data.submissions.length, verified_contacts: verified, target: 500 });
});

app.post('/api/submit', (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(phone)) return res.status(400).json({ error: 'Invalid phone: +1234567890' });
    const data = readData();
    if (data.submissions.some(s => s.phone === phone)) return res.status(400).json({ error: 'Phone already submitted' });
    const newSub = { id: data.nextId++, name, phone, verified: 0, submitted_at: new Date().toISOString() };
    data.submissions.push(newSub);
    writeData(data);
    res.json({ success: true, message: 'Submitted!' });
});

// Admin middleware
const checkAdmin = (req, res, next) => {
    const passkey = req.headers['x-admin-passkey'] || req.query.passkey;
    if (passkey === (process.env.ADMIN_PASSKEY || 'Quantix2024')) next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// Admin routes
app.get('/api/admin/submissions', checkAdmin, (req, res) => res.json(readData().submissions));
app.get('/api/admin/stats', checkAdmin, (req, res) => {
    const data = readData();
    const verified = data.submissions.filter(s => s.verified === 1).length;
    res.json({ total: data.submissions.length, verified, pending: data.submissions.length - verified });
});
app.put('/api/admin/verify/:id', checkAdmin, (req, res) => {
    const data = readData();
    const sub = data.submissions.find(s => s.id === parseInt(req.params.id));
    if (sub) { sub.verified = 1; writeData(data); res.json({ success: true }); }
    else res.status(404).json({ error: 'Not found' });
});
app.delete('/api/admin/delete/:id', checkAdmin, (req, res) => {
    const data = readData();
    data.submissions = data.submissions.filter(s => s.id !== parseInt(req.params.id));
    writeData(data);
    res.json({ success: true });
});
app.get('/api/admin/generate-vcf', checkAdmin, (req, res) => {
    const verified = readData().submissions.filter(s => s.verified === 1);
    let vcf = '';
    verified.forEach(c => { vcf += `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\nEND:VCARD\n`; });
    res.set('Content-Type', 'text/vcard');
    res.set('Content-Disposition', 'attachment; filename=quantix.vcf');
    res.send(vcf);
});

app.listen(PORT, () => console.log(`Server on ${PORT}`));
