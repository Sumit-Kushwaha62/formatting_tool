const crypto = require('crypto');

const MONETIZATION_DISABLED_RESPONSE = {
  error: 'Monetization is disabled',
  code: 'MONETIZATION_DISABLED',
};

function createRazorpayClient({ monetizationEnabled, RazorpayClient, keyId, keySecret }) {
  if (!monetizationEnabled) return null;
  return new RazorpayClient({ key_id: keyId, key_secret: keySecret });
}

function createPaymentHandlers({ monetizationEnabled, razorpay, supabase, paymentSecret, logger = console }) {
  const rejectDisabled = (res) => res.status(403).json(MONETIZATION_DISABLED_RESPONSE);

  const createOrder = async (req, res) => {
    if (!monetizationEnabled) return rejectDisabled(res);

    try {
      const order = await razorpay.orders.create({
        amount: 19900,
        currency: 'INR',
        receipt: 'receipt_' + Date.now(),
      });
      logger.log('Order created:', order.id);
      return res.json(order);
    } catch (err) {
      logger.error('Order create error:', err);
      return res.status(500).json({ error: 'Order creation failed' });
    }
  };

  const verifyPayment = async (req, res) => {
    if (!monetizationEnabled) return rejectDisabled(res);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;

    logger.log('verify-payment hit — userId:', userId);
    logger.log('payment_id:', razorpay_payment_id);

    if (!userId) {
      logger.error('userId missing!');
      return res.status(400).json({ error: 'userId required' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', paymentSecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      logger.error('Signature mismatch!');
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'pro', payment_id: razorpay_payment_id })
      .eq('id', userId);

    if (error) {
      logger.error('Supabase update error:', error);
      return res.status(500).json({ error: 'Plan update failed' });
    }

    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: userId,
      payment_id: razorpay_payment_id,
      amount: 19900,
    });

    if (paymentError) {
      logger.error('Supabase payment insert error:', paymentError);
      return res.status(500).json({ error: 'Payment history update failed' });
    }

    logger.log('Plan updated to pro for userId:', userId);
    return res.json({ success: true });
  };

  return { createOrder, verifyPayment };
}

module.exports = {
  MONETIZATION_DISABLED_RESPONSE,
  createPaymentHandlers,
  createRazorpayClient,
};
