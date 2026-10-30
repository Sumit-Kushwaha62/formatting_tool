require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Resilient Supabase client initialized strictly from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
let supabase = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (supaErr) {
  console.warn('Supabase initialization fallback:', supaErr.message);
}

const express = require('express');
const multer = require('multer');
const cors = require('cors');

const { spawn } = require('child_process');
const PYTHON_CMD = process.env.PYTHON_CMD || 'python3';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ERROR_CODES, sendSafeError } = require('./errors');
const adminStore = require('./adminStore');

const app = express();

// Robust Production CORS Configuration for Render
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Original-Filename'],
  exposedHeaders: ['Content-Disposition', 'X-Original-Filename'],
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Real-Time Render-like Telemetry Tracker
app.use((req, res, next) => {
  res.on('finish', () => {
    const isTool = req.path.startsWith('/api/') && !req.path.startsWith('/api/admin');
    adminStore.recordRequest(res.statusCode, isTool);
  });
  next();
});

const uploadsDir = path.resolve(__dirname, 'uploads');
const outputsDir = path.resolve(__dirname, 'outputs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_SIZE || 25 * 1024 * 1024), // default 25MB
    files: 10,
  },
});

// ── Health Check ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ── Converter Routes ──
app.post('/api/merge-pdf', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const outputName = `output_${Date.now()}.pdf`;
  const outputPath = path.resolve(uploadsDir, outputName);
  const args = [path.join(__dirname, 'converter.py'), 'merge_pdfs', outputPath, ...req.files.map(f => f.path)];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args);
      let stderr = '';
      child.stderr.on('data', data => stderr += data.toString());
      child.on('close', code => (code === 0 ? resolve() : reject(stderr)));
      child.on('error', reject);
    });
    res.json({ downloadUrl: `/api/download/${outputName}`, previewUrl: `/api/preview/${outputName}` });
  } catch (err) {
    console.error('Merge PDF Error:', err);
    res.status(500).json({ error: err || 'Merge failed' });
  } finally {
    req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
  }
});

app.post('/api/merge-word', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const outputName = `output_${Date.now()}.docx`;
  const outputPath = path.resolve(uploadsDir, outputName);
  const args = [path.join(__dirname, 'converter.py'), 'merge_word', outputPath, ...req.files.map(f => f.path)];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args);
      let stderr = '';
      child.stderr.on('data', data => stderr += data.toString());
      child.on('close', code => (code === 0 ? resolve() : reject(stderr)));
      child.on('error', reject);
    });
    res.json({ downloadUrl: `/api/download/${outputName}` });
  } catch (err) {
    console.error('Merge Word Error:', err);
    res.status(500).json({ error: err || 'Merge failed' });
  } finally {
    req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
  }
});

app.post('/api/pdf-to-word', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  
  const results = [];
  try {
    for (const file of req.files) {
      const outputName = `output_${uuidv4()}.docx`;
      const outputPath = path.resolve(uploadsDir, outputName);
      const inputPath = file.path;
      const args = [path.join(__dirname, 'converter.py'), 'pdf_to_word', inputPath, outputPath];

      await new Promise((resolve, reject) => {
        const child = spawn(PYTHON_CMD, args);
        let stderr = '';
        child.stderr.on('data', data => stderr += data.toString());
        child.on('close', code => (code === 0 ? resolve() : reject(stderr)));
        child.on('error', reject);
      });

      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      results.push({
        originalName: file.originalname,
        downloadUrl: `/api/download/${outputName}`
      });
    }
    res.json({ files: results });
  } catch (err) {
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) {}
      });
    }
    return sendSafeError(res, {
      status: 500,
      code: ERROR_CODES.PROCESSING_FAILED,
      message: 'PDF to Word conversion failed. Please ensure the PDF is not password protected or corrupted.',
      error: err,
      context: 'PDF to Word conversion failure',
    });
  }
});

app.post('/api/excel-to-pdf', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  
  const results = [];
  try {
    for (const file of req.files) {
      const outputName = `output_${uuidv4()}.pdf`;
      const outputPath = path.resolve(uploadsDir, outputName);
      const inputPath = file.path;
      const args = [path.join(__dirname, 'converter.py'), 'excel_to_pdf', inputPath, outputPath];

      await new Promise((resolve, reject) => {
        const child = spawn(PYTHON_CMD, args);
        let stderr = '';
        child.stderr.on('data', data => stderr += data.toString());
        child.on('close', code => (code === 0 ? resolve() : reject(stderr)));
        child.on('error', reject);
      });

      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      results.push({
        originalName: file.originalname,
        downloadUrl: `/api/download/${outputName}`
      });
    }
    res.json({ files: results });
  } catch (err) {
    console.error('Excel to PDF Error:', err);
    res.status(500).json({ error: err || 'Conversion failed' });
    // Cleanup remaining files on error
    req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
  }
});

// ── Hindi → KrutiDev Conversion Route ──
app.post('/api/convert-krutidev', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const inputPath  = req.file.path;
  const outputName = `krutidev_${uuidv4()}.docx`;
  const outputPath = path.resolve(outputsDir, outputName);
  const fontName   = req.body.font || 'Krutidev010';

  let stdout = '';
  const args = [
    path.join(__dirname, 'hindi_converter.py'),
    inputPath,
    outputPath,
    fontName,
  ];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args, { cwd: __dirname });
      let stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); console.log('[KrutiDev]', d.toString().trim()); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Process exited with code ${code}`));
      });
      child.on('error', reject);
    });

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Converted file was not created' });
    }

    const hadHindi = !stdout.includes('no Unicode Hindi found');

    let originalName = req.file.originalname || 'converted.docx';
    try { originalName = fixMojibakeFileName(originalName); } catch (_) {}
    const baseName = originalName.replace(/\.docx$/i, '');
    const dlName   = `${baseName}_krutidev.docx`;

    res.json({
      downloadUrl: `/download/${outputName}?name=${encodeURIComponent(dlName)}`,
      fileName:    dlName,
      had_hindi:   hadHindi,
    });
  } catch (err) {
    console.error('KrutiDev conversion error:', err.message || err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: 'Conversion failed. Please check your file and try again.' });
  } finally {
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (_) {}
  }
});

// ── Compress PDF Route ──
app.post('/api/compress-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Only .pdf files are supported for compression.' });
  }

  const level = req.body.level || 'recommended';
  const outputName = `output_${Date.now()}_compressed.pdf`;
  const outputPath = path.resolve(uploadsDir, outputName);
  const inputPath = req.file.path;
  const originalSize = req.file.size;

  const args = [path.join(__dirname, 'converter.py'), 'compress_pdf', inputPath, outputPath, level];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args);
      let stderr = '';
      child.stderr.on('data', data => stderr += data.toString());
      child.on('close', code => (code === 0 ? resolve() : reject(stderr)));
      child.on('error', reject);
    });

    const rawCompressedSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : originalSize;
    // Strict safeguard: compressed size must never exceed original size
    const compressedSize = Math.min(originalSize, rawCompressedSize);
    const percentSaved = originalSize > 0 ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100)) : 0;

    const dlName = `compressed_${req.file.originalname}`;
    res.json({
      downloadUrl: `/api/download/${outputName}?name=${encodeURIComponent(dlName)}`,
      previewUrl: `/api/preview/${outputName}`,
      originalName: req.file.originalname,
      originalSize,
      compressedSize,
      percentSaved,
    });
  } catch (err) {
    console.error('Compress PDF Error:', err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: 'PDF compression failed. Ensure the PDF is not password protected.' });
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

// ── Compress Image Route ──
app.post('/api/compress-image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  if (!allowed.includes(ext)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Only JPG, PNG, and WebP images are supported.' });
  }

  const level = req.body.level || 'recommended';
  const outputExt = ext === '.jpeg' ? '.jpg' : ext;
  const outputName = `compressed_${Date.now()}_${uuidv4().slice(0, 8)}${outputExt}`;
  const outputPath = path.resolve(uploadsDir, outputName);
  const inputPath = req.file.path;
  const originalSize = req.file.size;

  const args = [path.join(__dirname, 'converter.py'), 'compress_image', inputPath, outputPath, level];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args);
      let stderr = '';
      child.stderr.on('data', data => stderr += data.toString());
      child.on('close', code => (code === 0 ? resolve() : reject(new Error(stderr || `Process exited with code ${code}`))));
      child.on('error', reject);
    });

    const rawCompressedSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : originalSize;
    const compressedSize = Math.min(originalSize, rawCompressedSize);
    const percentSaved = originalSize > 0 ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100)) : 0;

    const dlName = `compressed_${req.file.originalname}`;
    res.json({
      downloadUrl: `/api/download/${outputName}?name=${encodeURIComponent(dlName)}`,
      previewUrl: `/api/preview/${outputName}`,
      originalName: req.file.originalname,
      originalSize,
      compressedSize,
      percentSaved,
    });
  } catch (err) {
    console.error('Compress Image Error:', err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: 'Image compression failed. Please check the image file.' });
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

// ── Remove Background Route ──
app.post('/api/remove-bg', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  if (!allowed.includes(ext)) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Only JPG, PNG, and WebP images are supported.' });
  }

  const outputName = `nobg_${Date.now()}_${uuidv4().slice(0, 8)}.png`;
  const outputPath = path.resolve(uploadsDir, outputName);
  const inputPath = req.file.path;
  const originalSize = req.file.size;

  const args = [path.join(__dirname, 'converter.py'), 'remove_background', inputPath, outputPath];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args, {
        env: {
          ...process.env,
          OMP_NUM_THREADS: '1',
          OPENBLAS_NUM_THREADS: '1',
          MKL_NUM_THREADS: '1',
          VECLIB_MAXIMUM_THREADS: '1',
          NUMEXPR_NUM_THREADS: '1',
        }
      });
      let stderr = '';
      child.stderr.on('data', data => stderr += data.toString());
      child.on('close', code => (code === 0 ? resolve() : reject(new Error(stderr || `Process exited with code ${code}`))));
      child.on('error', reject);
    });

    const outputSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    const dlName = `${req.file.originalname.replace(/\.[^/.]+$/, '')}_nobg.png`;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      downloadUrl: `/api/download/${outputName}?name=${encodeURIComponent(dlName)}`,
      previewUrl: `/api/preview/${outputName}`,
      originalName: req.file.originalname,
      originalSize,
      outputSize,
    });
  } catch (err) {
    console.error('Remove Background Error:', err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ error: 'Background removal failed. Please check the image file.' });
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

// ── Unlock PDF Route (Remove Password) ──
app.post('/api/unlock-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Only .pdf files are supported.' });
  }

  const password = req.body.password || '';
  const outputName = `unlocked_${Date.now()}_${uuidv4().slice(0, 8)}.pdf`;
  const outputPath = path.resolve(uploadsDir, outputName);
  const inputPath = req.file.path;
  const originalSize = req.file.size;

  const args = [path.join(__dirname, 'converter.py'), 'remove_pdf_password', inputPath, outputPath, password];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PYTHON_CMD, args);
      let stderr = '';
      child.stderr.on('data', data => stderr += data.toString());
      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else if (stderr.includes('ERROR_INCORRECT_PASSWORD') || code === 2) {
          const passErr = new Error('Incorrect password');
          passErr.isPassError = true;
          reject(passErr);
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });
      child.on('error', reject);
    });

    const outputSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : originalSize;
    const dlName = `unlocked_${req.file.originalname}`;

    res.json({
      downloadUrl: `/api/download/${outputName}?name=${encodeURIComponent(dlName)}`,
      previewUrl: `/api/preview/${outputName}`,
      originalName: req.file.originalname,
      originalSize,
      outputSize,
    });
  } catch (err) {
    console.error('Unlock PDF Error:', err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (err.isPassError) {
      return res.status(400).json({ error: 'Incorrect password. Please enter the correct password and try again.' });
    }
    res.status(500).json({ error: 'PDF unlocking failed. Please ensure the PDF is valid.' });
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
});

// ── Real-Time Inline Preview Route ──
app.get('/api/preview/:filename', (req, res) => {
  const filePath = path.resolve(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const ext = path.extname(req.params.filename).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/download/:filename', (req, res) => {
  const filePath = path.resolve(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const downloadName = req.query.name || req.params.filename;
  res.download(filePath, downloadName, (err) => {
    if (err && !res.headersSent) console.error('Download error:', err);
  });
});

const getOriginalDownloadName = (file) => {
  return file && file.originalname ? file.originalname : 'formatted_document.docx';
};

const fixMojibakeFileName = (name = 'formatted_document.docx') => {
  if (!name) return 'formatted_document.docx';

  const attempts = [
    name,
    Buffer.from(name, 'latin1').toString('utf8'),
    Buffer.from(name, 'binary').toString('utf8'),
  ];

  for (const value of attempts) {
    if (value && !/[àÃÂ¤¥§]/.test(value) && !value.includes('')) {
      return path.basename(value);
    }
  }

  return path.basename(Buffer.from(name, 'latin1').toString('utf8') || name);
};

const hasMojibake = (value = '') =>
  /(?:Ã|Â|à¤|à¥|à¦|à§|)/.test(value);

const fixMojibakeOnlyIfNeeded = (name = 'formatted_document.docx') => {
  if (!hasMojibake(name)) return path.basename(name);
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8');
    return path.basename(fixed.includes('') ? name : fixed);
  } catch {
    return path.basename(name);
  }
};

const encodeRFC5987ValueChars = (str) =>
  encodeURIComponent(str)
    .replace(/['()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/\*/g, '%2A');

const getRequestedDownloadName = (value) => {
  if (!value) return 'formatted_document.docx';

  try {
    return path.basename(decodeURIComponent(value)) || 'formatted_document.docx';
  } catch {
    return path.basename(value) || 'formatted_document.docx';
  }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Format route ──
app.post('/format', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('userId received:', req.body.userId);
  const inputPath = req.file.path;
  const outputName = uuidv4() + '_formatted.docx';
  const outputPath = path.resolve(outputsDir, outputName);
  const docType = req.body.docType || 'book';
  const options = req.body.options || '{}';

  const optionsFile = path.resolve(uploadsDir, uuidv4() + '_options.json');
  fs.writeFileSync(optionsFile, options);

  const formatterPath = path.join(__dirname, 'formatter.py');
  console.log('Running Formatter (spawn):', formatterPath, [inputPath, outputPath, docType, optionsFile]);

  const pythonProcess = spawn(PYTHON_CMD, [formatterPath, inputPath, outputPath, docType, optionsFile], {
    cwd: __dirname,
    windowsHide: true,
  });

  let stdoutData = '';
  let stderrData = '';
  const MAX_LOG_SIZE = 50 * 1024; // 50KB limit

  const appendLog = (current, newData) => {
    let combined = current + newData;
    if (combined.length > MAX_LOG_SIZE) {
      return combined.slice(-MAX_LOG_SIZE);
    }
    return combined;
  };

  pythonProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    console.log('[Formatter STDOUT]:', chunk.trim());
    stdoutData = appendLog(stdoutData, chunk);
  });

  pythonProcess.stderr.on('data', (data) => {
    stderrData = appendLog(stderrData, data.toString());
  });

  let isFinished = false;

  const safeUnlink = (filePath) => {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Cleanup error:', err.message);
    }
  };

  const cleanupTempFiles = ({ removeOutput = false } = {}) => {
    safeUnlink(optionsFile);
    safeUnlink(inputPath);
    if (removeOutput) safeUnlink(outputPath);
  };

  const failOnce = (statusCode, message) => {
    if (isFinished) return;
    isFinished = true;
    clearTimeout(timer);
    cleanupTempFiles({ removeOutput: true });

    if (!res.headersSent) {
      return res.status(statusCode).json({ error: message });
    }
  };

  const timeout = Number(process.env.FORMAT_TIMEOUT_MS || 900000); // default 15 minutes
  const timer = setTimeout(() => {
    if (isFinished) return;
    console.error(`Formatter timed out after ${timeout}ms. Killing process...`);
    try {
      pythonProcess.kill('SIGKILL');
    } catch (err) {
      console.error('Formatter kill error:', err.message);
    }
    failOnce(503, 'Processing timed out. Please try a smaller file.');
  }, timeout);

  pythonProcess.on('close', (code) => {
    if (isFinished) return;
    clearTimeout(timer);
    safeUnlink(optionsFile);

    if (code !== 0) {
      console.error(`Formatter process exited with code ${code}`);
      if (stderrData.trim()) console.error('Formatter stderr (last 50KB):\n', stderrData.trim());
      if (stdoutData.trim()) console.error('Formatter stdout (last 50KB):\n', stdoutData.trim());
      return failOnce(500, 'Formatting failed');
    }

    if (!fs.existsSync(outputPath)) {
      console.error('Formatter completed but output file was not created:', outputPath);
      return failOnce(500, 'Formatted file was not created');
    }

    isFinished = true;

    let originalName = getOriginalDownloadName(req.file);
    console.log('Original filename from multer:', req.file.originalname);
    console.log('Before filename fix:', originalName);
    originalName = fixMojibakeFileName(originalName);
    console.log('After filename fix:', originalName);
    const userId = req.body.userId;

    const sendDownload = () => {
      safeUnlink(inputPath);
      res.json({
        downloadUrl: `/download/${outputName}?name=${encodeURIComponent(originalName)}`,
        fileName: originalName,
      });
    };

    if (!userId) {
      console.warn('Document formatted without userId; skipping document log.');
      sendDownload();
      return;
    }

    Promise.race([
      supabase.from('documents').insert({
        user_id: userId,
        doc_type: docType,
        file_name: originalName,
        status: 'done',
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Document log timed out')), 8000);
      })
    ]).then(({ error }) => {
      if (error) {
        console.error('Supabase insert error:', error);
      } else {
        console.log('Document logged for userId:', userId);
      }
    }).catch((err) => {
      console.error('Supabase insert exception:', err);
    }).finally(() => {
      sendDownload();
    });
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start formatter process:', err);
    failOnce(500, 'Failed to start formatting');
  });
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.resolve(outputsDir, req.params.filename);
  if (!filePath.startsWith(outputsDir + path.sep) || !fs.existsSync(filePath)) {
    return sendSafeError(res, {
      status: 404,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'File not found or expired',
      context: 'Download file not found',
    });
  }

  let downloadName = getRequestedDownloadName(req.query.name);
  downloadName = fixMojibakeOnlyIfNeeded(downloadName);

  if (!downloadName.toLowerCase().endsWith('.docx')) {
    downloadName += '.docx';
  }

  const encodedName = encodeRFC5987ValueChars(downloadName);
  const asciiFallback = downloadName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\;]/g, '_');

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  res.setHeader('X-Original-Filename', encodedName);

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
  );

  const stream = fs.createReadStream(filePath);

  stream.on('error', (err) => {
    console.error('Download stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  });

  stream.on('close', () => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Download cleanup error:', err.message);
    }
  });

  stream.pipe(res);
});

app.delete('/account/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    await supabase.from('documents').delete().eq('user_id', userId);
    await supabase.from('payments').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error('Supabase auth delete error:', error);
      return res.status(500).json({ error: 'Account delete failed' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Account delete exception:', err);
    res.status(500).json({ error: 'Account delete failed' });
  }
});

// ── Razorpay: Order banao ──
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 19900,
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    });
    console.log('Order created:', order.id);
    res.json(order);
  } catch (err) {
    console.error('Order create error:', err);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// ── Razorpay: Payment verify ──
app.post('/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;

  console.log('verify-payment hit — userId:', userId);
  console.log('payment_id:', razorpay_payment_id);

  if (!userId) {
    console.error('userId missing!');
    return res.status(400).json({ error: 'userId required' });
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.error('Signature mismatch!');
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ plan: 'pro', payment_id: razorpay_payment_id })
    .eq('id', userId);

  if (error) {
    console.error('Supabase update error:', error);
    return res.status(500).json({ error: 'Plan update failed' });
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    user_id: userId,
    payment_id: razorpay_payment_id,
    amount: 19900,
  });

  if (paymentError) {
    console.error('Supabase payment insert error:', paymentError);
    return res.status(500).json({ error: 'Payment history update failed' });
  }

  console.log('Plan updated to pro for userId:', userId);
  res.json({ success: true });
});

// ── Contact Form (Public Endpoint with Dual Storage & SMTP) ──
const handleContactSubmission = async (req, res) => {
  const { name, email, message, subject, priority, category } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please provide name, email, and message.' });
  }

  try {
    // 1. Save to Admin Data Store (Local file + Supabase)
    const savedRecord = await adminStore.saveContactMessage({
      name,
      email,
      message,
      subject: subject || 'General Support Inquiry',
      category: category || 'Support',
      priority: priority || 'Normal',
    }, supabase);

    // 2. Send email via SMTP if configured (non-fatal if unconfigured)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        await transporter.sendMail({
          from: `"Format Studio Support" <${process.env.SMTP_USER}>`,
          to: process.env.CONTACT_EMAIL || 'sumitkushwaha99375@gmail.com',
          subject: `[Contact Inquiry] ${subject || 'Support'}: from ${name}`,
          html: `
            <h3>New Contact Inquiry - Format Studio</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Category:</strong> ${category || 'Support'}</p>
            <p><strong>Priority:</strong> ${priority || 'Normal'}</p>
            <p><strong>Message:</strong><br>${String(message).replace(/\n/g, '<br>')}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          `,
        });
      } catch (smtpErr) {
        console.warn('Contact SMTP notification skipped/failed (non-fatal):', smtpErr.message);
      }
    }

    res.json({ success: true, message: 'Your message has been received! We will get back to you shortly.', data: savedRecord });
  } catch (err) {
    console.error('Contact Submission Error:', err);
    res.status(500).json({ error: 'Failed to process inquiry. Please try again.' });
  }
};

app.post('/contact', handleContactSubmission);
app.post('/api/contact', handleContactSubmission);

// ── User Feedback Route (Public Endpoint with Dual Storage & SMTP) ──
app.post('/api/feedback', async (req, res) => {
  const { rating, category, tool, feedback, message, email, name } = req.body;
  const feedbackText = feedback || message || '';

  if (!feedbackText && !rating) {
    return res.status(400).json({ error: 'Please provide rating or feedback comments.' });
  }

  try {
    // 1. Save to Admin Data Store (Local file + Supabase)
    const savedRecord = await adminStore.saveFeedback({
      rating,
      category,
      tool,
      feedback: feedbackText,
      email,
      name,
    }, supabase);

    // 2. Send email notification if SMTP configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        await transporter.sendMail({
          from: `"Format Studio Feedback" <${process.env.SMTP_USER}>`,
          to: process.env.CONTACT_EMAIL || 'sumitkushwaha99375@gmail.com',
          subject: `Feedback [${category || 'General'}]: ${rating ? rating + '★' : 'User Input'}`,
          html: `
            <h3>Format Studio User Feedback</h3>
            <p><strong>Rating:</strong> ${rating ? rating + ' / 5' : 'Not specified'}</p>
            <p><strong>Category:</strong> ${category || 'General'}</p>
            <p><strong>Tool / Area:</strong> ${tool || 'All Tools'}</p>
            <p><strong>Feedback:</strong><br>${feedbackText ? String(feedbackText).replace(/\n/g, '<br>') : 'None'}</p>
            <p><strong>User:</strong> ${name || 'Anonymous'} (${email || 'No email provided'})</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          `,
        });
      } catch (smtpErr) {
        console.warn('Feedback SMTP notification skipped/failed (non-fatal):', smtpErr.message);
      }
    }

    return res.json({ success: true, message: 'Thank you for your valuable feedback!', data: savedRecord });
  } catch (err) {
    console.error('Feedback Submission Error:', err);
    return res.status(500).json({ error: 'Failed to record feedback.' });
  }
});

// ── Admin Authentication Middleware ──
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization || req.headers['x-admin-token'] || req.query.token;
  if (!adminStore.isValidAdminToken(token)) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
  }
  next();
};

// ── Admin Login Endpoint ──
app.post(['/api/admin/login', '/admin/login'], (req, res) => {
  const { password } = req.body;
  if (!password || !adminStore.verifyAdminPassword(password)) {
    return res.status(401).json({ success: false, error: 'Invalid admin passcode.' });
  }

  const token = adminStore.createAdminSession();
  res.json({
    success: true,
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    message: 'Admin access granted.',
  });
});

// ── Admin Render-like Live Metrics Endpoint ──
app.get(['/api/admin/metrics', '/admin/metrics'], requireAdmin, (req, res) => {
  const metrics = adminStore.getSystemMetrics(uploadsDir, outputsDir);
  res.json({ success: true, metrics });
});

// ── Admin Consolidated Data Endpoint ──
app.get(['/api/admin/data', '/admin/data'], requireAdmin, async (req, res) => {
  try {
    const metrics = adminStore.getSystemMetrics(uploadsDir, outputsDir);
    const contacts = adminStore.getContactMessages();
    const feedbacks = adminStore.getFeedbacks();
    const { users, recentDocuments } = await adminStore.getSupabaseUsersAndDocs(supabase);

    res.json({
      success: true,
      metrics,
      contacts,
      feedbacks,
      users,
      recentDocuments,
    });
  } catch (err) {
    console.error('Admin Data Fetch Error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve admin telemetry data.' });
  }
});

// ── Admin Update Contact Status ──
app.patch(['/api/admin/contacts/:id', '/admin/contacts/:id'], requireAdmin, (req, res) => {
  const { status } = req.body;
  const ok = adminStore.updateContactStatus(req.params.id, status || 'read');
  if (ok) {
    res.json({ success: true, message: 'Status updated.' });
  } else {
    res.status(404).json({ error: 'Contact message not found.' });
  }
});

// ── Admin Delete Contact Message ──
app.delete(['/api/admin/contacts/:id', '/admin/contacts/:id'], requireAdmin, (req, res) => {
  const ok = adminStore.deleteContactMessage(req.params.id);
  if (ok) {
    res.json({ success: true, message: 'Contact message removed.' });
  } else {
    res.status(404).json({ error: 'Contact message not found.' });
  }
});

// ── Admin Delete Feedback ──
app.delete(['/api/admin/feedbacks/:id', '/admin/feedbacks/:id'], requireAdmin, (req, res) => {
  const ok = adminStore.deleteFeedback(req.params.id);
  if (ok) {
    res.json({ success: true, message: 'Feedback entry removed.' });
  } else {
    res.status(404).json({ error: 'Feedback entry not found.' });
  }
});

// ── AI Suggest Route ──
app.post('/api/ai-suggest', async (req, res) => {
  const { docType, userPrompt } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  const defaults = {
    book: { font_style: 'Garamond', font_size: '12', line_spacing: '1.15', page_size: 'A5', page_numbers: true },
    thesis: { font_style: 'Times New Roman', font_size: '12', line_spacing: '1.5', page_size: 'A4', page_numbers: true },
    letter: { font_style: 'Arial', font_size: '11', line_spacing: '1.0', page_size: 'A4', page_numbers: false },
    research: { font_style: 'Times New Roman', font_size: '10', line_spacing: '1.0', page_size: 'A4', page_numbers: true }
  };

  const currentDefaults = defaults[docType] || defaults.book;

  if (!userPrompt || !geminiKey) {
    return res.json({ docType, options: currentDefaults, aiUsed: false });
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const systemPrompt = `You are a professional document formatter. 
    Available options:
    - font_style (e.g., 'Garamond', 'Times New Roman', 'Arial', 'Kruti Dev 010')
    - font_size (numeric string, e.g., '10', '11', '12', '14')
    - line_spacing (string, e.g., '1.0', '1.15', '1.5', '2.0')
    - page_size ('A4', 'A5', 'A3', 'Letter', 'Legal')
    - page_numbers (boolean)
    - page_number_position ('left', 'center', 'right')
    - header (string)
    - footer (string)
    - font_script ('english', 'hindi')

    Rules:
    - Always respond with valid JSON only. No explanations, no apologies, no markdown.
    - If user requests a feature that doesn't exist in the options, silently ignore it and return best matching available options.
    - Never write 'I'm sorry' or any conversational text. Only JSON output.

    Based on the user's request for a ${docType}, return ONLY a valid JSON object matching these keys. 
    If a value is not specified, use professional defaults for a ${docType}.
    Defaults for ${docType}: ${JSON.stringify(currentDefaults)}
    
    User request: "${userPrompt}"`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up potential markdown formatting from AI
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const options = JSON.parse(text);
      res.json({ docType, options: { ...currentDefaults, ...options }, aiUsed: true });
    } catch (parseErr) {
      console.log('AI parse failed, using defaults:', parseErr.message, 'Raw text:', text);
      res.json({ docType, options: currentDefaults, aiUsed: false });
    }
  } catch (err) {
    console.error('Gemini API Error:', err);
    res.json({ docType, options: currentDefaults, aiUsed: false });
  }
});

// ── Server start ──
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing server or use a different PORT.`);
      process.exit(1);
    }

    console.error('Server startup error:', err);
    process.exit(1);
  });

  // ── Maintenance Tasks ──

  // Self-ping to prevent Render cold starts (every 14 mins)
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      http.get(`http://localhost:${PORT}/health`, (res) => {
        console.log(`Self-ping status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('Self-ping failed:', err.message);
      });
    }, 14 * 60 * 1000);
  }

  // Cleanup old files in uploads/ (every 30 mins)
  setInterval(() => {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    let deletedCount = 0;
    try {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > ONE_HOUR) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      if (deletedCount > 0) console.log(`Cleanup: Deleted ${deletedCount} old files from uploads/`);
    } catch (err) {
      console.error('Cleanup job error:', err.message);
    }
  }, 30 * 60 * 1000);
}

module.exports = app;

