const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const SWAGGER_PATH = process.env.SWAGGER_PATH || path.join(__dirname, '..', 'contracts', 'payment-api.yaml');

// Serve swagger spec
app.get('/swagger.json', (req, res) => {
  try {
    const fileContents = fs.readFileSync(SWAGGER_PATH, 'utf8');
    res.json(yaml.load(fileContents));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to read swagger file' });
  }
});

// POST /payments
app.post('/payments', (req, res) => {
  const { paymentType, orderId, amount } = req.body;

  // Validate fields for contract-resiliency compliance
  if (!paymentType || orderId === undefined || amount === undefined) {
    return res.status(400).json({ error: 'Payment declined' });
  }

  if (typeof orderId !== 'number' || !Number.isInteger(orderId) || typeof amount !== 'number' || !Number.isInteger(amount)) {
    return res.status(400).json({ error: 'Payment declined' });
  }

  if (paymentType === 'card') {
    const { cardNumber, cardExpiry, cardCvv } = req.body;
    if (!cardNumber || !cardExpiry || !cardCvv || typeof cardNumber !== 'string' || typeof cardExpiry !== 'string' || typeof cardCvv !== 'string') {
      return res.status(400).json({ error: 'Payment declined' });
    }
    console.log(`Processing card payment of ${amount} for order ${orderId}`);
  } else if (paymentType === 'bank_transfer') {
    const { bankAccountNumber, bankRoutingNumber, bankAccountHolder } = req.body;
    if (!bankAccountNumber || !bankRoutingNumber || !bankAccountHolder || typeof bankAccountNumber !== 'string' || typeof bankRoutingNumber !== 'string' || typeof bankAccountHolder !== 'string') {
      return res.status(400).json({ error: 'Payment declined' });
    }
    console.log(`Processing bank transfer of ${amount} for order ${orderId}`);
  } else {
    return res.status(400).json({ error: 'Payment declined' });
  }

  res.json({ paymentId: 100, status: 'SUCCESS' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Payment Service running on port ${PORT}`);
});
