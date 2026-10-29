const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const TRANSACTIONS = {};

app.post('/api/pay', async (req, res) => {
  let { phone, amount } = req.body;
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  
  const externalRef = `DIGITAL_${Date.now()}`;
  
  try {
    // QUICK REPLY to frontend first to avoid "Sending..." stuck
    res.json({ 
      success: true, 
      external_reference: externalRef,
      message: "Sending STK..." 
    });

    // THEN send to PayHero in background
    const payload = {
      amount: Number(amount) || 100,
      phone_number: phone,
      channel_id: 14591,
      provider: "m-pesa",
      external_reference: externalRef,
      callback_url: "https://digitalservices-bwnx.onrender.com/api/callback",
      account_number: phone, // <-- ONLY FIX, was DIGITAL_ before
      customer_name: "Player"
    };

    const r = await axios.post(
      "https://backend.payhero.co.ke/api/v2/payments",
      payload,
      { headers: { Authorization: process.env.PAYHERO_BASIC_TOKEN } }
    );
    console.log("PayHero:", r.data);
    TRANSACTIONS[externalRef] = { status: "QUEUED", CheckoutRequestID: r.data.CheckoutRequestID };

  } catch (e) {
    console.error(e.response?.data || e.message);
  }
});

app.post('/api/callback', (req, res) => {
  console.log("Callback:", JSON.stringify(req.body));
  const data = req.body.response || req.body;
  if (data.ExternalReference) {
    TRANSACTIONS[data.ExternalReference] = {
      status: data.ResultCode == 0 ? "SUCCESS" : "FAILED",
      ...data
    };
  }
  res.json({ ResultCode: 0 });
});

app.get('/api/check-status/:ref', (req, res) => {
  res.json(TRANSACTIONS[req.params.ref] || { status: "NOT_FOUND" });
});

app.listen(process.env.PORT || 10000, () => console.log("Live"));
