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

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, uuidv4() + '.docx')
});
const upload = multer({ storage });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Format route ──
app.post('/format', upload.single('file'), (req, res) => {
  console.log('userId received:', req.body.userId);
  const inputPath = path.resolve(req.file.path);
  const outputName = uuidv4() + '_formatted.docx';
  const outputPath = path.resolve('outputs', outputName);
  const docType = req.body.docType || 'book';
  const options = req.body.options || '{}';

  const optionsFile = path.resolve('uploads', uuidv4() + '_options.json');
  fs.writeFileSync(optionsFile, options);

  const formatCommand = `python "${path.join(__dirname, 'formatter.py')}" "${inputPath}" "${outputPath}" "${docType}" "${optionsFile}"`;
  console.log('Running Formatter:', formatCommand);

  exec(formatCommand, (fErr, fStdout, fStderr) => {
    if (fs.existsSync(optionsFile)) fs.unlinkSync(optionsFile);
    if (fErr) {
      console.error('Format Error:', fStderr);
      return res.status(500).json({ error: 'Formatting failed' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8') || 'formatted_document.docx';

    res.download(outputPath, originalName, async (dlErr) => {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      const userId = req.body.userId;
      if (userId) {
        await supabase.from('documents').insert({
          user_id: userId,
          doc_type: docType,
          file_name: originalName,
          status: 'done',
        });
      }
    });
  });
});

// ── Razorpay: Order banao ──
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 19900, // ₹199 in paise — test ke liye 100 karo
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

  console.log('Plan updated to pro for userId:', userId);
  res.json({ success: true });
});

// ── Server start ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

