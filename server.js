const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let balances = {};

function getTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    let phoneFormatted = phone.toString().trim();
    if (phoneFormatted.startsWith('0')) phoneFormatted = '254' + phoneFormatted.slice(1);
    if (phoneFormatted.startsWith('+')) phoneFormatted = phoneFormatted.slice(1);
    
    const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim();
    const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim();
    const passkey = (process.env.MPESA_PASSKEY || '').trim();
    const shortcode = (process.env.MPESA_SHORTCODE || '').trim();
    const env = (process.env.MPESA_ENV || 'production').trim();

    const tokenUrl = env === 'production' 
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    const stkUrl = env === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    console.log(`ENV: ${env} SHORTCODE: ${shortcode} PHONE: ${phoneFormatted} AMOUNT: ${amount}`);

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenRes = await axios.get(tokenUrl, { headers: { Authorization: `Basic ${auth}` } });
    const token = tokenRes.data.access_token;
    console.log('TOKEN: 200 OK');

    const timestamp = getTimestamp();
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

    const stkRes = await axios.post(stkUrl, {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phoneFormatted,
      PartyB: shortcode,
      PhoneNumber: phoneFormatted,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "Aviator",
      TransactionDesc: "Deposit"
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('STK SENT:', stkRes.data);
    res.json(stkRes.data);
  } catch (e) {
    console.error('STK ERROR:', e.response?.data || e.message);
    res.status(500).json({ error: 'TOKEN FAIL', details: e.response?.data || e.message });
  }
});

app.post('/callback', (req, res) => {
  console.log('CALLBACK:', JSON.stringify(req.body));
  try {
    const body = req.body;
    const stk = body.Body?.stkCallback;
    if (stk?.ResultCode === 0) {
      const meta = stk.CallbackMetadata?.Item;
      const amount = meta?.find(i => i.Name === 'Amount')?.Value;
      const phone = meta?.find(i => i.Name === 'PhoneNumber')?.Value;
      if (phone && amount) {
        balances[phone] = (balances[phone] || 0) + amount;
        console.log(`BALANCE UPDATED ${phone}: ${balances[phone]}`);
      }
    }
  } catch (err) {}
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

app.get('/api/balance/:phone', (req, res) => {
  res.json({ balance: balances[req.params.phone] || 0 });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT} - MPESA Live Production`));
