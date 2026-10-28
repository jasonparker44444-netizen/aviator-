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
  const url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  try {
    const r = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    console.log('TOKEN OK');
    return r.data.access_token;
  } catch (e) {
    console.error('TOKEN FAIL:', JSON.stringify(e.response?.data || e.message));
    throw e;
  }
}

app.post('/api/deposit', async (req, res) => {
  try {
    let { phone, amount } = req.body;
    console.log('REQ:', phone, amount, 'ENV:', process.env.MPESA_ENV, 'CODE:', process.env.MPESA_SHORTCODE);
    if (!phone || !amount) return res.status(400).json({ error: 'phone+amount needed' });
    phone = phone.toString().trim();
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    if (phone.startsWith('+')) phone = phone.substring(1);

    // IMPORTANT: Safaricom STK only works for Safaricom numbers!
    // If you test with 25411 (Airtel) it will 400
    const token = await getToken();
    const shortcode = (process.env.MPESA_SHORTCODE || '8033859').trim();
    const passkey = (process.env.MPESA_PASSKEY || '').trim();
    if (!passkey) {
      console.error('NO PASSKEY SET');
      return res.status(400).json({ error: 'MPESA_PASSKEY missing in Render Environment' });
    }
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0,14);
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
      AccountReference: 'Aviator',
      TransactionDesc: 'Deposit'
    };

    const stkRes = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', stkData, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('STK OK:', JSON.stringify(stkRes.data));
    res.json(stkRes.data);

  } catch (err) {
    const data = err.response?.data;
    console.error('STK FAIL SAFARICOM SAID:', JSON.stringify(data || err.message));
    res.status(400).json({ error: data || err.message });
  }
});

app.post('/callback', (req, res) => {
  console.log('CALLBACK:', JSON.stringify(req.body).slice(0,500));
  const cb = req.body?.Body?.stkCallback;
  if (cb?.ResultCode === 0) {
    const items = cb.CallbackMetadata?.Item;
    const amt = items?.find(i=>i.Name==='Amount')?.Value;
    if (amt) { balance += parseInt(amt); console.log('NEW BALANCE:', balance); }
  }
  res.json({ ResultCode:0, ResultDesc:'ok' });
});

app.get('/api/balance', (req,res)=>{ res.json({ balance }); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`Server running on ${PORT} - MPESA Live Production`));
