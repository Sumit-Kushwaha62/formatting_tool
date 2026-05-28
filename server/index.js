require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(__dirname, 'uploads');
const outputsDir = path.resolve(__dirname, 'outputs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, uuidv4() + '.docx')
});
const upload = multer({ storage });

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

  const formatCommand = `python "${path.join(__dirname, 'formatter.py')}" "${inputPath}" "${outputPath}" "${docType}" "${optionsFile}"`;
  console.log('Running Formatter:', formatCommand);

  exec(formatCommand, { cwd: __dirname, windowsHide: true, maxBuffer: 10 * 1024 * 1024, timeout: 180000 }, (fErr, fStdout, fStderr) => {
    if (fs.existsSync(optionsFile)) fs.unlinkSync(optionsFile);

    if (fErr) {
      console.error('Format Error:', fStderr);
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(500).json({ error: 'Formatting failed' });
    }

    if (!fs.existsSync(outputPath)) {
      console.error('Formatter completed but output file was not created:', outputPath);
      if (fStdout) console.log('Formatter stdout:', fStdout);
      if (fStderr) console.error('Formatter stderr:', fStderr);
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(500).json({ error: 'Formatted file was not created' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8') || 'formatted_document.docx';
    const userId = req.body.userId;

    const sendDownload = () => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      res.json({ downloadUrl: '/download/' + outputName, fileName: originalName });
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
    });

    sendDownload();
  });
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

app.get('/download/:filename', (req, res) => {
  const filePath = path.resolve(outputsDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or expired' });
  }
  res.download(filePath, (err) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (err) console.error('Download error:', err);
  });
});

// ── Contact form ──
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }

  let emailSent = false;

  // Try SMTP if credentials are configured
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
        pool: true,
        maxConnections: 1,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await transporter.sendMail({
        from: `"Format Studio" <${process.env.SMTP_USER}>`,
        to: 'care@edwinepc.com',
        subject: `Contact Form: ${name}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br>${message}</p>`,
      });
      emailSent = true;
      console.log('Contact email sent via SMTP');
    } catch (smtpErr) {
      console.warn('SMTP failed, falling back to Supabase storage:', smtpErr.message);
    }
  }

  // Always store in Supabase contacts table as reliable backup
  try {
    const { error: dbError } = await supabase.from('contacts').insert({
      name,
      email,
      message,
      email_sent: emailSent,
    });
    if (dbError) {
      console.error('Supabase contacts insert error:', dbError);
      // If SMTP also failed, this is a total failure
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send message' });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Contact save error:', err);
    if (emailSent) {
      // Email was sent even though DB save failed — still success
      return res.json({ success: true });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── Server start ──
const PORT = process.env.PORT || 5000;
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing server or use a different PORT.`);
    process.exit(1);
  }

  console.error('Server startup error:', err);
  process.exit(1);
});
