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
  try {
    let { phone, amount } = req.body;

    if (phone.startsWith('0')) {
      phone = '254' + phone.slice(1);
    }

    const externalReference = `DIGITAL_${Date.now()}`;

    const response = await axios.post(
      'https://backend.payhero.co.ke/api/v2/payments',
      {
        amount: Number(amount),
        phone_number: phone,
        channel_id: 14591,
        provider: 'm-pesa',
        external_reference: externalReference,
        callback_url: 'https://digitalservices-bwnx.onrender.com/api/callback',
        account_number: '13469',
        customer_name: 'Customer'
      },
      {
        headers: {
          Authorization: process.env.PAYHERO_BASIC_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      data: response.data,
      external_reference: externalReference
    });

  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      error: error.response ? error.response.data : error.message
    });
  }
});

app.post('/api/callback', (req, res) => {
  console.log(req.body);
  res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
