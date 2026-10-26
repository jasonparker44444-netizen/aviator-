const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());

// Frontend page
app.get('/', (req,res)=>{
 res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AVIATOR FLY</title><style>body{background:#0a1f14;color:#fff;font-family:Arial;display:flex;flex-direction:column;align-items:center;padding:10px}.header,.balance,.controls{width:100%;max-width:400px;border-radius:10px;padding:12px;margin-bottom:8px}.header{background:#182b21;text-align:center;font-weight:bold}.balance{background:#00693f;text-align:center}.controls{background:#132a2a;padding:15px;border-radius:12px}.plane{font-size:30px;text-align:center;animation:float 1.5s infinite}.mult{font-size:40px;color:#f8ef4b;text-align:center;font-weight:bold}.input{width:100%;padding:12px;margin:6px 0;border-radius:8px;border:none;font-size:18px}.bet-btn{width:100%;padding:14px;background:#00e676;font-weight:bold;border:none;border-radius:8px;margin-top:6px}.deposit-btn{width:100%;padding:14px;background:#ffeb3b;font-weight:bold;border:none;border-radius:8px;margin-top:6px}.status{text-align:center;margin-top:10px;font-weight:bold}@keyframes float{0%{transform:translateY(0)}50%{transform:translateY(-10px)}100%{transform:translateY(0)}}</style></head><body><div class="header">AVIATOR FLY ✈️</div><div class="balance" id="balance">Balance: KES 0.00</div><div class="controls"><div class="plane">✈️</div><div class="mult" id="multiplier">1.00x</div><input id="betAmount" class="input" type="number" value="50"><button class="bet-btn" id="betBtn" onclick="handleBet()">BET</button><input id="phone" class="input" type="text" value="254115968876" placeholder="2547XXXXXXXX"><input id="depAmount" class="input" type="number" value="100"><button class="deposit-btn" onclick="deposit()">DEPOSIT - STK (Till 8033859)</button><div class="status" id="status"></div></div><script>
let balance=parseFloat(localStorage.getItem('avi_bal')||'0');let bet=0;let isFlying=false;let curMult=1;let crashAt=0;let interval;
function updateBal(){document.getElementById('balance').innerText='Balance: KES '+balance.toFixed(2);localStorage.setItem('avi_bal',balance);}
updateBal();
function handleBet(){if(isFlying){cashout()}else{placeBet()}}
function placeBet(){let amt=parseFloat(document.getElementById('betAmount').value);if(amt>balance){document.getElementById('status').innerText='Low balance! Deposit 100';return}if(isFlying)return;bet=amt;balance-=bet;updateBal();isFlying=true;curMult=1;crashAt=(Math.random()*4+1.1);document.getElementById('status').innerText='Flying... Click BET to Cashout';document.getElementById('betBtn').innerText='CASHOUT';interval=setInterval(()=>{curMult+=0.02;document.getElementById('multiplier').innerText=curMult.toFixed(2)+'x';if(curMult>=crashAt){crash()}},100)}
function cashout(){if(!isFlying)return;clearInterval(interval);let win=bet*curMult;balance+=win;updateBal();document.getElementById('status').innerText='WON KES '+win.toFixed(2)+' @ '+curMult.toFixed(2)+'x';resetGame()}
function crash(){clearInterval(interval);document.getElementById('status').innerText='CRASHED @ '+crashAt.toFixed(2)+'x LOST';resetGame()}
function resetGame(){isFlying=false;document.getElementById('betBtn').innerText='BET';document.getElementById('multiplier').innerText='1.00x'}
async function deposit(){const phone=document.getElementById('phone').value.trim();const amount=document.getElementById('depAmount').value.trim();if(!phone.startsWith('254')||phone.length!=12){alert('Use 2547XXXXXXXX 12 digits');return}document.getElementById('status').innerText='Sending STK to '+phone+'...';try{const res=await fetch('/stk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,amount})});const data=await res.json();document.getElementById('status').innerText=data.message||'Check phone';}catch(e){document.getElementById('status').innerText='Error: '+e.message}}
<\/script></body></html>`);
});

app.post('/stk', async (req,res)=>{
  const {phone, amount} = req.body;
  try{
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const passkey = process.env.MPESA_PASSKEY;
    const till = process.env.MPESA_TILL || "8033859";
    const shortcode = "174379";
    const auth = Buffer.from(key+":"+secret).toString('base64');
    const tokenRes = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+auth}});
    const token = tokenRes.data.access_token;
    const datetime = new Date();
    const timestamp = datetime.getFullYear() + ("0"+(datetime.getMonth()+1)).slice(-2) + ("0"+datetime.getDate()).slice(-2) + ("0"+datetime.getHours()).slice(-2) + ("0"+datetime.getMinutes()).slice(-2) + ("0"+datetime.getSeconds()).slice(-2);
    const password = Buffer.from(shortcode+passkey+timestamp).toString('base64');
    const stkData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: parseInt(amount),
      PartyA: phone,
      PartyB: till,
      PhoneNumber: phone,
      CallBackURL: "https://aviator-quoe.onrender.com/callback",
      AccountReference: "Aviator",
      TransactionDesc: "Deposit"
    };
    console.log("STK PUSH:", stkData);
    const stkRes = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', stkData, {headers:{Authorization:'Bearer '+token}});
    console.log("SAFARICOM OK:", stkRes.data);
    res.json({success:true, message:"STK Sent! Check phone: "+phone, data:stkRes.data});
  }catch(err){
    console.log("STK ERROR:", err.response ? err.response.data : err.message);
    res.json({success:false, message:"STK Failed: "+(err.response?JSON.stringify(err.response.data):err.message)});
  }
});

app.post('/callback', (req,res)=>{
  console.log("CALLBACK:", JSON.stringify(req.body));
  res.json({ResultCode:0, ResultDesc:"Accepted"});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log("Live on "+PORT));
