import axios from 'axios';
import { useAuth } from './useAuth';

export function usePayment() {
  const { user, refreshPlanAndDocs } = useAuth();

  const handlePayment = async (onSuccess) => {
    if (!user) {
      alert('Please log in first.');
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      // 1. Create order on the server
      const { data } = await axios.post(`${API_URL}/create-order`, {}, { timeout: 600000 });

      // 2. Open Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: 'INR',
        name: 'Format Studio',
        description: 'Professional Plan — ₹199/month',
        order_id: data.id,
        handler: async (response) => {
          try {
            // 3. Verify payment on server
            const verifyRes = await axios.post(`${API_URL}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user.id,
            }, { timeout: 600000 });

            if (verifyRes.data && (verifyRes.data.success || verifyRes.status === 200)) {
              // 4. Update state and notify
              await refreshPlanAndDocs(user.id);
              alert('Payment successful! Pro plan activated.');
              if (onSuccess) onSuccess();
            } else {
              alert('Payment verification failed.');
            }
          } catch (verifyErr) {
            console.error('Verification Error:', verifyErr);
            alert('Failed to verify payment with server.');
          }
        },
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        theme: { color: '#1A2744' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Razorpay Error:', err);
      alert('Payment failed. Please try again.');
    }
  };

  return { handlePayment };
}
