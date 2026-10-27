const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const ENV = (process.env.MPESA_ENV || 'production').trim();
const TILL = (process.env.TILL_NUMBER || '8033859').trim();
const SHORTCODE = (process.env.MPESA_SHORTCODE || '8033859').trim();
const CONSUMER_KEY = (process.env.MPESA_CONSUMER_KEY || '').trim();
const CONSUMER_SECRET = (process.env.MPESA_CONSUMER_SECRET || '').trim();
const PASSKEY = (process.env.MPESA_PASSKEY || '').trim();
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://aviator-quoe.onrender.com/callback';

async function getToken() {
  const url = ENV === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  console.log(`Trying TOKEN: ${url} | KeyLen:${CONSUMER_KEY.length} SecretLen:${CONSUMER_SECRET.length}`);
  
  try {
    const res = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    console.log('TOKEN OK');
    return res.data.access_token;
  } catch (err) {
    console.log('TOKEN FAILED FULL:', JSON.stringify(err.response?.data || err.message));
    throw new Error(`TOKEN FAILED FULL: ${JSON.stringify(err.response?.data)}`);
  }
}

app.post('/stkpush', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

    const token = await getToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

    const stkUrl = ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: parseInt(amount),
      PartyA: phone,
      PartyB: TILL,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'Aviator',
      TransactionDesc: 'Deposit'
    };

    const stkRes = await axios.post(stkUrl, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('STK Response:', JSON.stringify(stkRes.data));
    res.json(stkRes.data);

  } catch (err) {
    console.log('STK ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/callback', (req, res) => {
  console.log('CALLBACK:', JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Live on ${PORT} | ENV:${ENV} TILL:${TILL} KEYLEN:${CONSUMER_KEY.length}`));
