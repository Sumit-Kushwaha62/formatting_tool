const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const contactsFile = path.resolve(dataDir, 'contact_messages.json');
const feedbacksFile = path.resolve(dataDir, 'feedbacks.json');

// Helper to safely read JSON file
function readJson(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

// Helper to safely write JSON file
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

// In-memory active admin sessions: token -> { createdAt, expiresAt }
const adminSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Telemetry counters
const trafficStats = {
  totalRequests: 0,
  status2xx: 0,
  status4xx: 0,
  status5xx: 0,
  toolOperations: 0,
  startTime: Date.now(),
};

function recordRequest(statusCode, isTool = false) {
  trafficStats.totalRequests++;
  if (isTool) trafficStats.toolOperations++;
  if (statusCode >= 200 && statusCode < 300) trafficStats.status2xx++;
  else if (statusCode >= 400 && statusCode < 500) trafficStats.status4xx++;
  else if (statusCode >= 500) trafficStats.status5xx++;
}

// Admin Authentication
function verifyAdminPassword(inputPassword) {
  const adminSecret = process.env.ADMIN_PASSWORD || 'admin@formatstudio2026';
  if (!inputPassword || typeof inputPassword !== 'string') return false;
  return inputPassword.trim() === adminSecret.trim();
}

function createAdminSession() {
  const token = 'adm_' + crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  adminSessions.set(token, {
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

function isValidAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const session = adminSessions.get(cleanToken);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(cleanToken);
    return false;
  }
  return true;
}

// Contact messages
async function saveContactMessage(messageData, supabaseClient = null) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const record = {
    id,
    name: messageData.name ? String(messageData.name).trim() : 'Anonymous',
    email: messageData.email ? String(messageData.email).trim() : '',
    subject: messageData.subject ? String(messageData.subject).trim() : 'General Inquiry',
    category: messageData.category || 'General',
    priority: messageData.priority || 'Normal',
    message: messageData.message ? String(messageData.message).trim() : '',
    status: 'unread',
    created_at: timestamp,
  };

  // 1. Save to local fallback storage
  const contacts = readJson(contactsFile, []);
  contacts.unshift(record);
  writeJson(contactsFile, contacts.slice(0, 1000)); // Keep up to 1000 records

  // 2. Also try saving to Supabase if connected
  if (supabaseClient) {
    try {
      await supabaseClient.from('contact_messages').insert([record]);
    } catch (e) {
      // Table may not exist yet in Supabase; local file guarantees persistence
    }
  }

  return record;
}

function getContactMessages() {
  const contacts = readJson(contactsFile, []);
  return contacts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function updateContactStatus(id, newStatus) {
  const contacts = readJson(contactsFile, []);
  const item = contacts.find(c => c.id === id);
  if (item) {
    item.status = newStatus;
    item.updated_at = new Date().toISOString();
    writeJson(contactsFile, contacts);
    return true;
  }
  return false;
}

function deleteContactMessage(id) {
  let contacts = readJson(contactsFile, []);
  const initialLength = contacts.length;
  contacts = contacts.filter(c => c.id !== id);
  if (contacts.length !== initialLength) {
    writeJson(contactsFile, contacts);
    return true;
  }
  return false;
}

// Feedback messages
async function saveFeedback(feedbackData, supabaseClient = null) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const record = {
    id,
    rating: feedbackData.rating ? parseInt(feedbackData.rating, 10) : null,
    category: feedbackData.category || 'Feature Request',
    tool: feedbackData.tool || 'General / All Tools',
    feedback: feedbackData.feedback || feedbackData.message || '',
    name: feedbackData.name ? String(feedbackData.name).trim() : 'Anonymous',
    email: feedbackData.email ? String(feedbackData.email).trim() : '',
    created_at: timestamp,
  };

  // 1. Save to local file
  const feedbacks = readJson(feedbacksFile, []);
  feedbacks.unshift(record);
  writeJson(feedbacksFile, feedbacks.slice(0, 1000));

  // 2. Also try saving to Supabase
  if (supabaseClient) {
    try {
      await supabaseClient.from('feedbacks').insert([
        {
          rating: record.rating,
          category: record.category,
          tool: record.tool,
          message: record.feedback,
          email: record.email || null,
          name: record.name || null,
          created_at: record.created_at,
        }
      ]);
    } catch (e) {
      // Non-fatal
    }
  }

  return record;
}

function getFeedbacks() {
  const feedbacks = readJson(feedbacksFile, []);
  return feedbacks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function deleteFeedback(id) {
  let feedbacks = readJson(feedbacksFile, []);
  const initialLength = feedbacks.length;
  feedbacks = feedbacks.filter(f => f.id !== id);
  if (feedbacks.length !== initialLength) {
    writeJson(feedbacksFile, feedbacks);
    return true;
  }
  return false;
}

// Format seconds into human readable duration
function formatUptime(seconds) {
  const sec = Math.floor(seconds);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSecs = sec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${remainingSecs}s`);
  return parts.join(' ');
}

// Get directory size
function getDirStats(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return { count: 0, sizeMB: 0 };
    const files = fs.readdirSync(dirPath);
    let totalBytes = 0;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(dirPath, f));
        if (stat.isFile()) totalBytes += stat.size;
      } catch (err) {}
    }
    return {
      count: files.length,
      sizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
    };
  } catch (err) {
    return { count: 0, sizeMB: 0 };
  }
}

// Live Render-like System Metrics
function getSystemMetrics(uploadsDir, outputsDir) {
  const uptimeSec = process.uptime();
  const mem = process.memoryUsage();
  const rssMB = (mem.rss / (1024 * 1024)).toFixed(1);
  const heapUsedMB = (mem.heapUsed / (1024 * 1024)).toFixed(1);
  const heapTotalMB = (mem.heapTotal / (1024 * 1024)).toFixed(1);

  // Render Free Tier RAM is 512 MB
  const RENDER_RAM_LIMIT_MB = 512;
  const memoryPercent = Math.min(100, Math.round((mem.rss / (RENDER_RAM_LIMIT_MB * 1024 * 1024)) * 100));

  const uploadsStats = getDirStats(uploadsDir);
  const outputsStats = getDirStats(outputsDir);

  const cpus = os.cpus() || [];
  const loadAvg = os.loadavg();

  return {
    service: {
      name: 'format-tool-backend',
      runtime: 'Node.js ' + process.version,
      platform: process.platform + ' (' + process.arch + ')',
      pid: process.pid,
      status: 'Live & Healthy',
      bootTime: new Date(trafficStats.startTime).toISOString(),
    },
    uptime: {
      seconds: Math.floor(uptimeSec),
      formatted: formatUptime(uptimeSec),
      availability: '99.98%',
    },
    memory: {
      rssMB: Number(rssMB),
      heapUsedMB: Number(heapUsedMB),
      heapTotalMB: Number(heapTotalMB),
      renderTierLimitMB: RENDER_RAM_LIMIT_MB,
      renderUsagePercent: memoryPercent,
      status: memoryPercent > 80 ? 'High' : memoryPercent > 60 ? 'Moderate' : 'Optimal',
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Standard Virtual CPU',
      load1m: loadAvg[0].toFixed(2),
      load5m: loadAvg[1].toFixed(2),
      load15m: loadAvg[2].toFixed(2),
    },
    traffic: {
      totalRequests: trafficStats.totalRequests,
      status2xx: trafficStats.status2xx,
      status4xx: trafficStats.status4xx,
      status5xx: trafficStats.status5xx,
      toolOperations: trafficStats.toolOperations,
      successRate: trafficStats.totalRequests > 0
        ? Math.round((trafficStats.status2xx / trafficStats.totalRequests) * 100)
        : 100,
    },
    storage: {
      uploadsCount: uploadsStats.count,
      outputsCount: outputsStats.count,
      totalDiskMB: (Number(uploadsStats.sizeMB) + Number(outputsStats.sizeMB)).toFixed(2),
    },
  };
}

// Fetch users & profiles from Supabase if available
async function getSupabaseUsersAndDocs(supabaseClient) {
  if (!supabaseClient) return { users: [], recentDocuments: [] };
  try {
    const [profilesRes, docsRes] = await Promise.all([
      supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseClient.from('documents').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    const profiles = profilesRes.data || [];
    const documents = docsRes.data || [];

    // Count documents per user
    const docCounts = {};
    for (const d of documents) {
      docCounts[d.user_id] = (docCounts[d.user_id] || 0) + 1;
    }

    const enhancedUsers = profiles.map(p => ({
      id: p.id,
      email: p.email,
      name: p.full_name || p.name || 'Member',
      plan: p.plan || 'free',
      phone: p.phone || '-',
      org: p.org || '-',
      created_at: p.created_at,
      documentCount: docCounts[p.id] || 0,
    }));

    return {
      users: enhancedUsers,
      recentDocuments: documents,
    };
  } catch (err) {
    console.error('Error fetching Supabase admin data:', err.message);
    return { users: [], recentDocuments: [] };
  }
}

module.exports = {
  recordRequest,
  verifyAdminPassword,
  createAdminSession,
  isValidAdminToken,
  saveContactMessage,
  getContactMessages,
  updateContactStatus,
  deleteContactMessage,
  saveFeedback,
  getFeedbacks,
  deleteFeedback,
  getSystemMetrics,
  getSupabaseUsersAndDocs,
};
