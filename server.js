const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(__dirname));

const ENV = (process.env.MPESA_ENV||'production').trim();
const TILL = (process.env.TILL_NUMBER||'8033859').trim();
const SHORTCODE = (process.env.MPESA_SHORTCODE||'8033859').trim();
const KEY = (process.env.MPESA_CONSUMER_KEY||'').trim();
const SECRET = (process.env.MPESA_CONSUMER_SECRET||'').trim();
const PASSKEY = (process.env.MPESA_PASSKEY||'').trim();
const CALLBACK_URL = (process.env.CALLBACK_URL||'https://aviator-quoe.onrender.com/callback').trim();

console.log(`ENV:${ENV} TILL:${TILL} KEY_LEN:${KEY.length} SECRET_LEN:${SECRET.length} PASS_LEN:${PASSKEY.length}`);

async function getToken(){
  const url = ENV==='production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const auth = Buffer.from(`${KEY}:${SECRET}`).toString('base64');
  try{
    const r = await axios.get(url,{headers:{Authorization:`Basic ${auth}`}});
    console.log('TOKEN OK');
    return r.data.access_token;
  }catch(e){
    console.log('TOKEN FAILED FULL:', JSON.stringify(e.response?.data||e.message));
    throw new Error(JSON.stringify(e.response?.data||e.message));
  }
}

app.post('/stkpush', async (req,res)=>{
  try{
    let {phone, amount} = req.body;
    console.log('STK REQUEST:', phone, amount);
    if(!phone) return res.status(400).json({error:'Phone required'});
    phone = phone.toString().trim();
    if(phone.startsWith('0')) phone = '254'+phone.slice(1);
    if(!phone.startsWith('254')) phone = '254'+phone;

    const token = await getToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    const password = Buffer.from(SHORTCODE+PASSKEY+timestamp).toString('base64');
    const stkUrl = ENV==='production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: parseInt(amount)||100,
      PartyA: phone,
      PartyB: TILL,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'AviatorFly',
      TransactionDesc: 'Deposit'
    };
    console.log('Sending STK to', stkUrl, 'Till', TILL);
    const resp = await axios.post(stkUrl, payload, {headers:{Authorization:`Bearer ${token}`}});
    console.log('STK SUCCESS:', resp.data);
    res.json(resp.data);
  }catch(err){
    console.log('STK ERROR:', err.message);
    res.status(500).json({error: err.message});
  }
});

app.post('/callback', (req,res)=>{
  console.log('CALLBACK RECEIVED:', JSON.stringify(req.body));
  res.json({ResultCode:0, ResultDesc:'Accepted'});
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'index.html')));

const PORT = process.env.PORT||10000;
app.listen(PORT, ()=> console.log(`Live on ${PORT}`));
