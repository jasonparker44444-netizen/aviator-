const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- FIX FOR "Cannot GET /" ERROR ---
// Serve your frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Root - serves your index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'index.html'), (err2) => {
        if (err2) {
          res.send(`
            <h1>DIGITAL SERVICES</h1>
            <p>Channel 14591 • Account 13469</p>
            <p>Server is Live ✅</p>
            <p>Go to /public/index.html or check your frontend location</p>
          `);
        }
      });
    }
  });
});

// --- YOUR OLD WORKING PAY LOGIC ---
app.post('/api/pay', async (req, res) => {
  try {
    let { phone, amount } = req.body;
    console.log("Pay request:", req.body);

    if (!phone) return res.status(400).json({ success: false, msg: "Phone required" });

    // Format phone
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('+')) phone = phone.slice(1);

    const externalRef = `DIGITAL_${Date.now()}`;

    const payload = {
      amount: Number(amount) || 100,
      phone_number: phone,
      channel_id: 14591,
      provider: "m-pesa",
      external_reference: externalRef,
      callback_url: "https://digitalservices-bwnx.onrender.com/api/callback",
      account_number: "13469", // <-- YOUR OLD WORKING ACCOUNT! Not DIGITAL_
      customer_name: "Player"
    };

    console.log("Sending to PayHero:", payload);

    const response = await axios.post(
      "https://backend.payhero.co.ke/api/v2/payments",
      payload,
      {
        headers: {
          Authorization: process.env.PAYHERO_BASIC_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("PayHero OK:", response.data);

    res.json({
      success: true,
      external_reference: externalRef,
      CheckoutRequestID: response.data.CheckoutRequestID,
      data: response.data
    });

  } catch (err) {
    console.error("PAY ERROR:", err.response?.data || err.message);
    // Still reply so frontend doesn't stick on Sending...
    res.status(500).json({ 
      success: false, 
      error: err.response?.data || err.message 
    });
  }
});

app.post('/api/callback', (req, res) => {
  console.log("CALLBACK:", JSON.stringify(req.body, null, 2));
  res.json({ ResultCode: 0, ResultDesc: "Received" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT}`));
