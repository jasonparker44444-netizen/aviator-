require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- MPESA CONFIG FROM RENDER ENV ---
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim();
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim();
const PASSKEY = process.env.MPESA_PASSKEY?.trim();
const SHORTCODE = process.env.MPESA_SHORTCODE?.trim(); // 8033859
const CALLBACK_URL = process.env.CALLBACK_URL?.trim(); // https://aviator-1-k3kc.onrender.com/callback
const ENV = (process.env.MPESA_ENV || 'production').trim();

console.log('ENV:', ENV, 'SHORTCODE:', SHORTCODE, 'CALLBACK:', CALLBACK_URL);

// --- 1. GET TOKEN ---
async function getToken() {
    const url = ENV === 'production' 
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    
    try {
        const res = await axios.get(url, {
            headers: { Authorization: `Basic ${auth}` }
        });
        console.log('TOKEN: 200 - Success');
        return res.data.access_token;
    } catch (e) {
        console.log('TOKEN FAIL:', e.response?.data || e.message);
        throw new Error('Token failed');
    }
}

// --- 2. STK PUSH ---
app.post('/api/mpesa/stkpush', async (req, res) => {
    let { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and Amount required' });

    // Format phone to 2547...
    phone = phone.toString().replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('7')) phone = '254' + phone;

    amount = Math.round(amount);

    try {
        const token = await getToken();
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
        const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

        const stkUrl = ENV === 'production'
            ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

        const payload = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerBuyGoodsOnline', // For Till 8033859 - THIS IS IMPORTANT
            Amount: amount,
            PartyA: phone,
            PartyB: SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: CALLBACK_URL,
            AccountReference: 'Aviator',
            TransactionDesc: 'Deposit'
        };

        console.log('STK REQUEST:', { phone, amount, PartyB: SHORTCODE });

        const stkRes = await axios.post(stkUrl, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('STK SENT:', stkRes.data);
        res.json(stkRes.data);

    } catch (err) {
        console.error('STK ERROR:', err.response?.data || err.message);
        res.status(500).json(err.response?.data || { error: 'STK Failed' });
    }
});

// Alias for your frontend if it uses /deposit
app.post('/api/deposit', (req, res) => {
    req.url = '/api/mpesa/stkpush';
    app.handle(req, res);
});

// --- 3. CALLBACK ---
app.post('/callback', (req, res) => {
    console.log('=== CALLBACK RECEIVED ===');
    console.log(JSON.stringify(req.body, null, 2));

    const stkCallback = req.body.Body?.stkCallback;
    if (stkCallback) {
        if (stkCallback.ResultCode === 0) {
            console.log('PAYMENT SUCCESS');
            // TODO: Add balance to user here
            // const amount = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'Amount').Value
            // const phone = stkCallback.CallbackMetadata.Item.find(i => i.Name === 'PhoneNumber').Value
        } else {
            console.log('PAYMENT FAILED:', stkCallback.ResultDesc);
        }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/', (req, res) => res.send('Aviator MPESA Live - Production'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
