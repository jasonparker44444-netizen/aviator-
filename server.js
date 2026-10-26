const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

app.post('/stk-push', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    const shortcode = process.env.MPESA_TILL || "8033859";
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const passkey = process.env.MPESA_PASSKEY;
    
    if(!key || !secret || !passkey) {
      return res.json({success:false, message:"Missing ENV keys on Render"});
    }

    console.log("STK PUSH REQUEST:", phone, amount, "Till:", shortcode);
    
    // 1. Get Token
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    let tokenRes;
    try {
      tokenRes = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
      });
    } catch (e) {
      console.log("TOKEN ERROR:", e.response?.data || e.message, "Status:", e.response?.status);
      return res.json({success:false, message:"TOKEN FAILED: " + JSON.stringify(e.response?.data || e.message)});
    }
    
    const token = tokenRes.data.access_token;
    console.log("TOKEN OK");

    // 2. STK Push
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0,-3);
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');
    
    const stkData = {
      BusinessShortCode: Number(shortcode),
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Number(amount),
      PartyA: Number(phone),
      PartyB: Number(shortcode),
      PhoneNumber: Number(phone),
      CallBackURL: "https://aviator-quoe.onrender.com/callback",
      AccountReference: "AVIATOR",
      TransactionDesc: "Deposit"
    };
    
    console.log("STK DATA:", JSON.stringify(stkData));
    
    const stkRes = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', stkData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log("SAFARICOM OK:", stkRes.data);
    res.json({success:true, message:"STK Sent! Check phone: "+phone, data: stkRes.data});
    
  } catch (err) {
    const realError = err.response ? JSON.stringify(err.response.data) + " STATUS:" + err.response.status : err.message;
    console.log("STK ERROR FULL:", realError);
    console.log("STK ERROR STACK:", err.stack);
    res.json({success:false, message:"STK Failed: " + realError});
  }
});

app.post('/callback', (req, res) => {
  console.log("CALLBACK:", JSON.stringify(req.body));
  res.json({ResultCode:0, ResultDesc:"Accepted"});
});

app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Live on ${PORT}`));
