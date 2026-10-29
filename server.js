// DigitalServices - PayHero STK Push Server
// Account: 13469 | Channel: 14591 | Name: digitalservices

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PAYHERO = {
  accountId: process.env.PAYHERO_ACCOUNT_ID || 13469,
  channelId: parseInt(process.env.PAYHERO_CHANNEL_ID) || 14591,
  basicAuthToken: process.env.PAYHERO_BASIC_TOKEN || 'Basic SJBRcX1zFQwTU04WEI5U2JqTnc6QkhJTVk0aTl4T0IzSU5IZ1dYTFR2ZyQkd1T1ZYOUJwR01uODBtMA==',
  baseUrl: 'https://backend.payhero.co.ke/api/v2',
  callbackUrl: process.env.CALLBACK_URL || 'https://digital-services-k3kc.onrender.com/api/callback'
};

app.get('/', (req,res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/deposit', async (req,res) => {
  try {
    let { phone, amount, user_id } = req.body;
    let p = phone.toString().replace(/\s+/g,'');
    if(p.startsWith('0')) p='254'+p.slice(1);
    if(p.startsWith('+254')) p=p.slice(1);
    
    const payload = {
      amount: parseInt(amount),
      phone_number: p,
      channel_id: PAYHERO.channelId,
      provider: 'm-pesa',
      external_reference: `DIGITAL_${Date.now()}`,
      callback_url: PAYHERO.callbackUrl
    };

    const r = await axios.post(`${PAYHERO.baseUrl}/payments`, payload, {
      headers: { Authorization: PAYHERO.basicAuthToken, 'Content-Type':'application/json' }
    });

    res.json({ success:true, message:'STK Sent to '+p, data:r.data });
  } catch(e){
    res.status(500).json({ success:false, error:e.response?.data || e.message });
  }
});

app.post('/api/callback', (req,res) => {
  console.log('CALLBACK:', JSON.stringify(req.body,null,2));
  res.json({ ResultCode:0, ResultDesc:'OK' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`DigitalServices running on ${PORT}`));
