require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

const app = express();
app.use(cors({
  exposedHeaders: ['Content-Disposition', 'X-Original-Filename'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    res.json({ downloadUrl: `/api/download/${outputName}` });
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
    console.error('PDF to Word Error:', err);
    res.status(500).json({ error: err || 'Conversion failed' });
    // Cleanup remaining files on error
    req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
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

app.get('/api/download/:filename', (req, res) => {
  const filePath = path.resolve(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, (err) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
    return res.status(404).json({ error: 'File not found or expired' });
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

// ── Contact form ──
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: `"Format Studio" <${process.env.SMTP_USER}>`,
      to: 'care@edwinepc.com',
      subject: `Contact Form: ${name}`,
      html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br>${message}</p>`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
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
