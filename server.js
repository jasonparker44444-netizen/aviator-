require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let balance = 0;

async function getToken() {
  const key = (process.env.MPESA_CONSUMER_KEY || '').trim();
  const secret = (process.env.MPESA_CONSUMER_SECRET || '').trim();
  const env = (process.env.MPESA_ENV || 'production').trim();
  const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  try {
    const res = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    return res.data.access_token;
  } catch (e) {
    console.error('TOKEN FAIL:', e.response?.data || e.message);
    throw e;
  }
}

app.post('/api/deposit', async (req, res) => {
  try {
    let { phone, amount } = req.body;
    console.log('DEPOSIT REQ:', phone, amount);
    
    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone and amount required' });
    }
    
    phone = phone.toString().trim();
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    if (phone.startsWith('+')) phone = phone.substring(1);
    
    const token = await getToken();
    console.log('TOKEN OK');
    
    const shortcode = (process.env.MPESA_SHORTCODE || '8033859').trim();
    const passkey = (process.env.MPESA_PASSKEY || '').trim();
    
    if (!passkey) {
      console.error('NO PASSKEY SET!');
      return res.status(400).json({ error: 'MPESA_PASSKEY not set in Render' });
    }
    
    const env = (process.env.MPESA_ENV || 'production').trim();
    const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    
    const stkData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: parseInt(amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: (process.env.CALLBACK_URL || 'https://aviator-1-k3kc.onrender.com/callback').trim(),
      AccountReference: 'Till5259614',
      TransactionDesc: 'Aviator Deposit'
    };
    
    console.log('SENDING STK:', stkData);
    const stkRes = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, stkData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('STK OK:', stkRes.data);
    res.json(stkRes.data);
    
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('STK FAIL:', JSON.stringify(errData));
    res.status(400).json({ error: errData });
  }
});

app.post('/callback', (req, res) => {
  console.log('[CALLBACK]', JSON.stringify(req.body, null, 2));
  const result = req.body?.Body?.stkCallback;
  if (result?.ResultCode === 0) {
    const meta = result.CallbackMetadata?.Item;
    const amount = meta?.find(i => i.Name === 'Amount')?.Value;
    if (amount) {
      balance += parseInt(amount);
      console.log('BALANCE UPDATED:', balance);
    }
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/api/balance', (req, res) => {
  res.json({ balance });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
