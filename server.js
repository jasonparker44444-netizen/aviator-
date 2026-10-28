const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));
let balance=0;
async function getToken(){
 const key=(process.env.MPESA_CONSUMER_KEY||'').trim();
 const secret=(process.env.MPESA_CONSUMER_SECRET||'').trim();
 const auth=Buffer.from(`${key}:${secret}`).toString('base64');
 const r=await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:`Basic ${auth}`}});
 console.log('TOKEN OK');
 return r.data.access_token;
}
app.post('/api/deposit',async(req,res)=>{
 try{
  let {phone,amount}=req.body;
  console.log('REQ',phone,amount);
  phone=phone.toString().replace('+','').trim();
  if(phone.startsWith('0'))phone='254'+phone.substring(1);
  const token=await getToken();
  const shortcode=(process.env.MPESA_SHORTCODE||'8033859').trim();
  const passkey=(process.env.MPESA_PASSKEY||'').trim();
  const ts=new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
  const pwd=Buffer.from(shortcode+passkey+ts).toString('base64');
  const data={BusinessShortCode:shortcode,Password:pwd,Timestamp:ts,TransactionType:'CustomerBuyGoodsOnline',Amount:parseInt(amount),PartyA:phone,PartyB:shortcode,PhoneNumber:phone,CallBackURL:'https://aviator-1-k3kc.onrender.com/callback',AccountReference:'Aviator',TransactionDesc:'Deposit'};
  const resp=await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',data,{headers:{Authorization:`Bearer ${token}`}});
  console.log('STK OK',JSON.stringify(resp.data));
  res.json(resp.data);
 }catch(e){
  console.error('STK FAIL:',JSON.stringify(e.response?.data||e.message));
  res.status(400).json({error:e.response?.data||e.message});
 }
});
app.post('/callback',(req,res)=>{
 console.log('CB',JSON.stringify(req.body).slice(0,400));
 const c=req.body?.Body?.stkCallback;
 if(c?.ResultCode===0){const a=c.CallbackMetadata?.Item?.find(x=>x.Name==='Amount')?.Value;if(a)balance+=parseInt(a);}
 res.json({ResultCode:0,ResultDesc:'ok'});
});
app.get('/api/balance',(req,res)=>res.json({balance}));
const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log('Server running on '+PORT));
