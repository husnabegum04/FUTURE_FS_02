const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'leads.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'crm-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  })
);

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function normalizeLead(lead) {
  return {
    ...lead,
    deleted: Boolean(lead.deleted),
    deletedAt: lead.deletedAt || null,
    notes: Array.isArray(lead.notes) ? lead.notes : []
  };
}

function readLeads() {
  ensureDataFile();
  const rawLeads = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const leads = Array.isArray(rawLeads) ? rawLeads.map(normalizeLead) : [];

  if (JSON.stringify(leads) !== JSON.stringify(rawLeads)) {
    writeLeads(leads);
  }

  return leads;
}

function writeLeads(leads) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

function ensureAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function buildLead(payload) {
  const now = new Date().toISOString();
  return {
    id: `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: payload.name,
    email: payload.email,
    source: payload.source || 'Website Form',
    status: payload.status || 'new',
    followUpDate: payload.followUpDate || '',
    notes: payload.notes || [],
    deleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function sortLeads(leads) {
  return leads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: Boolean(req.session.authenticated) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.json({ success: true, message: 'Login successful' });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/leads', ensureAuthenticated, (req, res) => {
  const leads = sortLeads(readLeads().filter((lead) => !lead.deleted));
  res.json(leads);
});

app.get('/api/leads/trash', ensureAuthenticated, (req, res) => {
  const leads = sortLeads(readLeads().filter((lead) => lead.deleted));
  res.json(leads);
});

app.post('/api/leads', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const lead = buildLead(req.body);
  leads.unshift(lead);
  writeLeads(leads);
  res.status(201).json(lead);
});

app.post('/api/leads/public', (req, res) => {
  const leads = readLeads();
  const lead = buildLead({ ...req.body, status: 'new' });
  leads.unshift(lead);
  writeLeads(leads);
  res.status(201).json({ success: true, message: 'Lead saved successfully' });
});

app.put('/api/leads/:id', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((item) => item.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const { name, email, source, status, followUpDate } = req.body;
  if (name !== undefined) {
    lead.name = name;
  }
  if (email !== undefined) {
    lead.email = email;
  }
  if (source !== undefined) {
    lead.source = source;
  }
  if (status) {
    lead.status = status;
  }
  if (followUpDate !== undefined) {
    lead.followUpDate = followUpDate;
  }
  lead.updatedAt = new Date().toISOString();
  writeLeads(leads);
  return res.json(lead);
});

app.delete('/api/leads/:id', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((item) => item.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  lead.deleted = true;
  lead.deletedAt = new Date().toISOString();
  lead.updatedAt = new Date().toISOString();
  writeLeads(leads);
  return res.json({ success: true });
});

app.post('/api/leads/:id/restore', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((item) => item.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  lead.deleted = false;
  lead.deletedAt = null;
  lead.updatedAt = new Date().toISOString();
  writeLeads(leads);
  return res.json({ success: true, lead });
});

app.delete('/api/leads/:id/permanent', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const remainingLeads = leads.filter((item) => item.id !== req.params.id);

  if (remainingLeads.length === leads.length) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  writeLeads(remainingLeads);
  return res.json({ success: true });
});

app.post('/api/leads/:id/notes', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const lead = leads.find((item) => item.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
  }

  lead.notes.unshift({
    id: `note-${Date.now()}`,
    content: content.trim(),
    createdAt: new Date().toISOString()
  });
  lead.updatedAt = new Date().toISOString();
  writeLeads(leads);
  return res.json(lead);
});

app.get('/api/metrics', ensureAuthenticated, (req, res) => {
  const leads = readLeads();
  const activeLeads = leads.filter((lead) => !lead.deleted);
  const metrics = {
    total: activeLeads.length,
    new: activeLeads.filter((lead) => lead.status === 'new').length,
    contacted: activeLeads.filter((lead) => lead.status === 'contacted').length,
    converted: activeLeads.filter((lead) => lead.status === 'converted').length,
    trashCount: leads.filter((lead) => lead.deleted).length
  };
  res.json(metrics);
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CRM server running on http://localhost:${PORT}`);
});
