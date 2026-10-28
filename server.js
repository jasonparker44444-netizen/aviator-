require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let balance = 0;

// --- MPESA TOKEN ---
async function getToken() {
  const key = (process.env.MPESA_CONSUMER_KEY || '').trim();
  const secret = (process.env.MPESA_CONSUMER_SECRET || '').trim();
  
  const env = (process.env.MPESA_ENV || 'production').trim();
  const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  
  const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  console.log(`[MPESA] Requesting token from ${baseUrl}...`);
  
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` }
    });
    console.log('[MPESA] Token OK');
    return res.data.access_token;
  } catch (err) {
    console.log('[MPESA] TOKEN FAIL:', err.response?.data || err.message);
    throw err;
  }
}

// --- STK PUSH ---
app.post('/api/deposit', async (req, res) => {
  try {
    let { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount required' });

    // Format phone 254...
    phone = phone.toString().trim();
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    if (phone.startsWith('+')) phone = phone.substring(1);

    const token = await getToken();

    const shortcode = (process.env.MPESA_SHORTCODE || '8033859').trim(); // Head Office 8033859
    const passkey = (process.env.MPESA_PASSKEY || '').trim();
    const transactionType = (process.env.MPESA_TRANSACTION_TYPE || 'CustomerBuyGoodsOnline').trim();
    
    const env = (process.env.MPESA_ENV || 'production').trim();
    const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // For Store Till 5259614 under Shortcode 8033859
    // Money goes to 8033859 and settles to Till 5259614 on Safaricom side
    const stkData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: parseInt(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: (process.env.CALLBACK_URL || 'https://aviator-1-k3kc.onrender.com/callback').trim(),
      AccountReference: 'Till5259614', // Shows your Till 5259614 in reference
      TransactionDesc: 'Aviator Deposit'
    };

    console.log('[MPESA] Sending STK to', phone, 'Amount', amount, 'Shortcode', shortcode);

    const stkRes = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      stkData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('[MPESA] STK Response:', stkRes.data);
    return res.json(stkRes.data);

  } catch (err) {
    console.error('[MPESA] STK FAIL:', err.response?.data || err.message);
    return res.status(400).json({ 
      error: 'TOKEN FAIL or STK FAIL', 
      details: err.response?.data || err.message 
    });
  }
});

// --- CALLBACK ---
app.post('/callback', (req, res) => {
  console.log('[MPESA CALLBACK]', JSON.stringify(req.body, null, 2));
  
  try {
    const result = req.body?.Body?.stkCallback;
    if (result?.ResultCode === 0) {
      const meta = result.CallbackMetadata?.Item;
      const amount = meta?.find(i => i.Name === 'Amount')?.Value;
      if (amount) {
        balance += parseInt(amount);
        console.log(`[BALANCE] +${amount} New balance: ${balance}`);
      }
    }
  } catch (e) {
    console.log('Callback parse error', e.message);
  }
  
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/api/balance', (req, res) => res.json({ balance }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT} - MPESA Live Production`));
