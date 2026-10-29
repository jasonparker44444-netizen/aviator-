// server.js - FIXED FOR ABC BANK CHANNEL 14591
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files if you have frontend
app.use(express.static(path.join(__dirname, 'public')));

const PAYHERO_TOKEN = process.env.PAYHERO_BASIC_TOKEN; // Put "Basic VjJ..." in Render ENV
const PAYHERO_URL = "https://backend.payhero.co.ke/api/v2/payments";
const CALLBACK_URL = "https://digitalservices-bwnx.onrender.com/api/callback";

// Simple in-memory DB - Replace with real DB later
const TRANSACTIONS = {};

// HOME
app.get('/', (req, res) => {
  res.json({ status: "LIVE", message: "Digital Services API - Fixed for ABC Bank ✅" });
});

// 1. INITIATE PAYMENT - FIXED ACCOUNT NUMBER
app.post('/api/pay', async (req, res) => {
  try {
    let { phone, amount, gameId } = req.body;
    
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });
    
    // Format phone: 011... -> 25411...
    let formattedPhone = phone.toString().replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    }
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.slice(1);
    }

    const finalAmount = Number(amount) || 10;
    const externalRef = `DIGITAL_${Date.now()}_${Math.floor(Math.random()*1000)}`;

    // THIS IS THE FIX FOR YOUR SCREENSHOT ERROR
    const payload = {
      amount: finalAmount,
      phone_number: formattedPhone,
      channel_id: 14591,
      provider: "m-pesa",
      external_reference: externalRef,
      callback_url: CALLBACK_URL,
      account_number: formattedPhone, // FIX: Must be numeric/phone, NOT DIGITAL_...
      customer_name: "Gamer",
      customer_email: "player@digitalservices.co.ke"
    };

    console.log("PAY REQUEST:", payload);

    const response = await axios.post(PAYHERO_URL, payload, {
      headers: {
        'Authorization': PAYHERO_TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log("PAYHERO SUCCESS:", response.data);

    TRANSACTIONS[externalRef] = {
      status: "QUEUED",
      phone: formattedPhone,
      amount: finalAmount,
      gameId,
      CheckoutRequestID: response.data.CheckoutRequestID,
      createdAt: new Date()
    };

    return res.json({
      success: true,
      queued: true,
      external_reference: externalRef,
      CheckoutRequestID: response.data.CheckoutRequestID,
      message: `STK sent to ${formattedPhone}. Enter PIN.`
    });

  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error("PAY ERROR:", errData);
    return res.status(500).json({ success: false, error: errData });
  }
});

// 2. CALLBACK - PAYHERO WILL CALL THIS
app.post('/api/callback', (req, res) => {
  console.log("========== CALLBACK ==========");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("==============================");

  try {
    const resp = req.body.response || req.body;
    const ResultCode = resp.ResultCode;
    const ResultDesc = resp.ResultDesc;
    const ExternalReference = resp.ExternalReference;
    const MpesaReceipt = resp.MpesaReceiptNumber;
    const Amount = resp.Amount;
    const Phone = resp.Phone;
    const Status = resp.Status;

    if (!ExternalReference) {
      console.log("No ExternalReference in callback");
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (ResultCode == 0 && (Status === "Success" || Status === undefined)) {
      console.log(`✅ SUCCESS ${ExternalReference} Receipt ${MpesaReceipt}`);
      TRANSACTIONS[ExternalReference] = {
        ...TRANSACTIONS[ExternalReference],
        status: "SUCCESS",
        MpesaReceiptNumber: MpesaReceipt,
        Amount,
        Phone,
        ResultDesc,
        paidAt: new Date()
      };
    } else {
      console.log(`❌ FAILED ${ExternalReference}: ${ResultDesc}`);
      TRANSACTIONS[ExternalReference] = {
        ...TRANSACTIONS[ExternalReference],
        status: "FAILED",
        ResultCode,
        ResultDesc,
        Amount,
        Phone,
        failedAt: new Date()
      };
    }

  } catch (e) {
    console.error("Callback processing error:", e.message);
  }

  // MUST return success to PayHero
  res.json({ ResultCode: 0, ResultDesc: "Callback received successfully" });
});

// 3. CHECK STATUS - FRONTEND POLLS THIS TO START GAME
app.get('/api/check-status/:ref', (req, res) => {
  const data = TRANSACTIONS[req.params.ref];
  if (!data) return res.json({ status: "NOT_FOUND" });
  res.json(data);
});

// 4. MANUAL CHECK (for testing)
app.get('/api/transactions', (req, res) => {
  res.json(TRANSACTIONS);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Callback URL: ${CALLBACK_URL}`);
});
