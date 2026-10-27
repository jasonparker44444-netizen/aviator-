const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const TILL = (process.env.TILL_NUMBER||'8033859').trim();
const SHORTCODE = (process.env.MPESA_SHORTCODE||'8033859').trim();
const KEY = (process.env.MPESA_CONSUMER_KEY||'').trim();
const SECRET = (process.env.MPESA_CONSUMER_SECRET||'').trim();
const PASSKEY = (process.env.MPESA_PASSKEY||'').trim();
const CALLBACK = (process.env.CALLBACK_URL||'https://aviator-1-k3kc.onrender.com/callback').trim();

console.log(`START TILL:${TILL} SHORT:${SHORTCODE} KEYLEN:${KEY.length} CB:${CALLBACK}`);

function reqHttps(opts, body){
 return new Promise((ok, fail)=>{
  const r = https.request(opts, res=>{
   let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ ok({s:res.statusCode, d:JSON.parse(d)}); }catch{ ok({s:res.statusCode, d}); } });
  });
  r.on('error', fail); if(body) r.write(body); r.end();
 });
}

app.post('/stkpush', async (req,res)=>{
 try{
  let {phone, amount} = req.body;
  phone=String(phone).replace(/\D/g,''); if(phone.startsWith('0')) phone='254'+phone.slice(1); if(phone.startsWith('7')) phone='254'+phone;
  const auth = Buffer.from(`${KEY}:${SECRET}`).toString('base64');
  const t1 = await reqHttps({hostname:'api.safaricom.co.ke', path:'/oauth/v1/generate?grant_type=client_credentials', method:'GET', headers:{Authorization:`Basic ${auth}`}});
  console.log('TOKEN:', t1.s, JSON.stringify(t1.d));
  if(!t1.d.access_token) throw new Error('TOKEN FAIL '+JSON.stringify(t1.d));
  const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
  const password = Buffer.from(SHORTCODE+PASSKEY+timestamp).toString('base64');
  const payload = JSON.stringify({BusinessShortCode:SHORTCODE, Password:password, Timestamp:timestamp, TransactionType:'CustomerBuyGoodsOnline', Amount:parseInt(amount)||1, PartyA:phone, PartyB:TILL, PhoneNumber:phone, CallBackURL:CALLBACK, AccountReference:'Aviator', TransactionDesc:'Deposit'});
  const t2 = await reqHttps({hostname:'api.safaricom.co.ke', path:'/mpesa/stkpush/v1/processrequest', method:'POST', headers:{Authorization:`Bearer ${t1.d.access_token}`, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(payload)}}, payload);
  console.log('STK:', JSON.stringify(t2.d));
  res.json(t2.d);
 }catch(e){ console.log('ERR', e.message); res.status(500).json({error:e.message}); }
});
app.post('/callback', (req,res)=>{ console.log('CALLBACK', JSON.stringify(req.body)); res.json({ResultCode:0, ResultDesc:'OK'}); });
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'index.html')));
app.listen(process.env.PORT||10000, ()=> console.log('Live'));
