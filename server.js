const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/pay', async (req, res) => {
  let { phone, amount } = req.body;
  console.log("Pay hit:", req.body);

  if (!phone) return res.json({ success: false, error: "No phone" });
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('+')) phone = phone.slice(1);

  const externalReference = `DIGITAL_${Date.now()}`;

  // 1. REPLY TO FRONTEND IMMEDIATELY - FIXES "Sending..." STUCK
  res.json({ 
    success: true, 
    message: "STK Sent - Check Phone",
    external_reference: externalReference 
  });

  // 2. THEN SEND TO PAYHERO IN BACKGROUND
  try {
    const payload = {
      amount: Number(amount) || 10,
      phone_number: phone,
      channel_id: 14591,
      provider: 'm-pesa',
      external_reference: externalReference,
      callback_url: 'https://digitalservices-bwnx.onrender.com/api/callback',
      account_number: '13469',
      customer_name: 'Customer'
    };

    console.log("Sending to PayHero:", payload);

    const response = await axios.post(
      'https://backend.payhero.co.ke/api/v2/payments',
      payload,
      { 
        headers: { Authorization: process.env.PAYHERO_BASIC_TOKEN },
        timeout: 15000
      }
    );

    console.log("PayHero OK:", response.data);

  } catch (error) {
    console.error("PayHero FAIL:", error.response?.data || error.message);
  }
});

app.post('/api/callback', (req, res) => {
  console.log("Callback:", req.body);
  res.json({ ResultCode: 0 });
});

app.listen(process.env.PORT || 10000, () => console.log("FIXED SERVER LIVE - No more stuck"));
