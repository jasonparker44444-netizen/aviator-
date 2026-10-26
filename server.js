const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// ENV
const ENV = (process.env.MPESA_ENV || 'production').toLowerCase();
const CONSUMER_KEY = (process.env.MPESA_CONSUMER_KEY || '').trim();
const CONSUMER_SECRET = (process.env.MPESA_CONSUMER_SECRET || '').trim();
const PASSKEY = (process.env.MPESA_PASSKEY || '').trim();
const TILL = (process.env.TILL_NUMBER || '8033859').trim();
const SHORTCODE = (process.env.MPESA_SHORTCODE || TILL).trim();

console.log(`=== ENV: ${ENV} | TILL: ${TILL} | SHORTCODE: ${SHORTCODE} ===`);
console.log(`KEY START: ${CONSUMER_KEY.substring(0,6)}... LEN:${CONSUMER_KEY.length}`);
console.log(`SECRET LEN: ${CONSUMER_SECRET.length} PASSKEY LEN: ${PASSKEY.length}`);

function getUrls(){
  if(ENV === 'sandbox'){
    return {
      token: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stk: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    };
  } else {
    return {
      token: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      stk: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    };
  }
}

async function getToken(){
  const urls = getUrls();
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  console.log(`Requesting TOKEN from: ${urls.token}`);
  try{
    const res = await axios.get(urls.token, {
      headers: { Authorization: `Basic ${auth}` }
    });
    console.log('TOKEN OK');
    return res.data.access_token;
  }catch(err){
    const data = err.response?.data || err.message;
    console.error('TOKEN FAILED FULL:', JSON.stringify(data));
    throw new Error(`TOKEN FAILED: ${JSON.stringify(data)}`);
  }
}

app.post('/stk-push', async (req, res) => {
  const { phone, amount } = req.body;
  console.log(`STK PUSH REQUEST: ${phone} ${amount} Till:${TILL} ENV:${ENV}`);
  
  if(!phone || !amount) return res.json({ success:false, message:'Phone and amount required' });
  
  try{
    const token = await getToken();
    const urls = getUrls();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0,14);
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
    
    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: Number(amount),
      PartyA: String(phone).replace(/\D/g,'').replace(/^0/,'254'),
      PartyB: TILL,
      PhoneNumber: String(phone).replace(/\D/g,'').replace(/^0/,'254'),
      CallBackURL: 'https://aviator-quoe.onrender.com/callback',
      AccountReference: 'Aviator',
      TransactionDesc: 'Deposit'
    };
    
    console.log('STK Payload:', JSON.stringify(payload));
    
    const stkRes = await axios.post(urls.stk, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('STK Response:', JSON.stringify(stkRes.data));
    return res.json({ success:true, message:'STK sent! Check phone', data: stkRes.data });
    
  }catch(err){
    const data = err.response?.data || err.message;
    console.error('STK FAILED:', JSON.stringify(data));
    return res.json({ success:false, message: `STK Error: ${JSON.stringify(data)}` });
  }
});

app.post('/callback', (req,res)=>{
  console.log('CALLBACK:', JSON.stringify(req.body));
  res.json({ResultCode:0, ResultDesc:'OK'});
});

app.get('/', (req,res)=> res.sendFile(__dirname + '/index.html'));

app.listen(PORT, ()=> console.log(`Live on ${PORT}`));
