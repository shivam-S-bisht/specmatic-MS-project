const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Kafka } = require('kafkajs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3001';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3002';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const SWAGGER_PATH = process.env.SWAGGER_PATH || path.join(__dirname, '..', 'contracts', 'order-api.yaml');

const ORDER_API_KEY = process.env.ORDER_API_KEY;
const PAYMENT_SERVICE_TOKEN = process.env.PAYMENT_SERVICE_TOKEN;
for (const [name, value] of Object.entries({ ORDER_API_KEY, PAYMENT_SERVICE_TOKEN })) {
  if (!value) {
    console.error(`${name} is not set. Refusing to start. See .env.example.`);
    process.exit(1);
  }
}

// In-memory Order DB
const orders = {};
let orderIdCounter = 1;

// Initialize Kafka
const kafka = new Kafka({
  clientId: 'order-service',
  brokers: [KAFKA_BROKER]
});
const producer = kafka.producer();

let kafkaConnected = false;
async function connectKafka() {
  while (!kafkaConnected) {
    try {
      console.log(`Connecting to Kafka at ${KAFKA_BROKER}...`);
      await producer.connect();
      console.log('Connected to Kafka!');
      kafkaConnected = true;
    } catch (err) {
      console.error('Failed to connect to Kafka:', err.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
connectKafka();

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

// GET /orders/:id
app.get('/orders/:id', (req, res) => {
  const idVal = parseInt(req.params.id);
  if (isNaN(idVal)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const order = orders[idVal];
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// DELETE /orders/:id
app.delete('/orders/:id', (req, res) => {
  const apiKey = req.header('X-API-Key');
  if (!apiKey || apiKey !== ORDER_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized API key' });
  }

  const idVal = parseInt(req.params.id);
  if (isNaN(idVal)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const order = orders[idVal];
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  delete orders[idVal];
  console.log(`Deleted order ${idVal}`);
  res.status(204).end();
});

// POST /orders
app.post('/orders', async (req, res) => {
  const { itemId, quantity } = req.body;

  // 1. Validate fields for contract compliance
  if (itemId === undefined || quantity === undefined) {
    return res.status(400).json({ error: 'Invalid request payload' });
  }

  if (typeof itemId !== 'number' || !Number.isInteger(itemId) || typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    return res.status(400).json({ error: 'Invalid request payload' });
  }

  // 2. Fetch item from Inventory Service to get price
  let itemPrice = 0;
  try {
    console.log(`Fetching item details for item ${itemId} from ${INVENTORY_SERVICE_URL}...`);
    const itemResponse = await fetch(`${INVENTORY_SERVICE_URL}/items/${itemId}`);
    if (!itemResponse.ok) {
      return res.status(400).json({ error: 'Invalid order request' });
    }
    const itemData = await itemResponse.json();
    itemPrice = itemData.price;
  } catch (err) {
    console.error('Failed to connect to Inventory service:', err.message);
    return res.status(500).json({ error: 'Inventory service unavailable' });
  }

  // 3. Reserve stock on Inventory Service
  try {
    console.log(`Reserving ${quantity} of item ${itemId}...`);
    const reserveResponse = await fetch(`${INVENTORY_SERVICE_URL}/items/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, quantity })
    });
    if (!reserveResponse.ok) {
      return res.status(400).json({ error: 'Invalid order request' });
    }
  } catch (err) {
    console.error('Failed to reserve stock:', err.message);
    return res.status(500).json({ error: 'Inventory service unavailable' });
  }

  // 4. Charge payment via Payment Service (using discriminator Card schema)
  const orderId = orderIdCounter++;
  const amount = itemPrice * quantity;
  try {
    console.log(`Charging ${amount} for order ${orderId} via ${PAYMENT_SERVICE_URL}...`);
    const paymentResponse = await fetch(`${PAYMENT_SERVICE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYMENT_SERVICE_TOKEN}`
      },
      body: JSON.stringify({
        paymentType: 'card',
        orderId,
        amount,
        cardNumber: "1234-5678-9012-3456",
        cardExpiry: "12/28",
        cardCvv: "123"
      })
    });
    if (!paymentResponse.ok) {
      return res.status(400).json({ error: 'Invalid order request' });
    }
  } catch (err) {
    console.error('Failed to process payment:', err.message);
    return res.status(500).json({ error: 'Payment service unavailable' });
  }

  // 5. Save Order
  const confirmedOrder = {
    orderId,
    itemId,
    quantity,
    status: 'CONFIRMED'
  };
  orders[orderId] = confirmedOrder;

  // 6. Publish OrderCreated event to Kafka. Attempted on demand rather than
  // gated on a startup flag: connect() may still be in flight, and kafkajs
  // establishes the connection on first send.
  try {
    if (!kafkaConnected) {
      await producer.connect();
      kafkaConnected = true;
    }
    await producer.send({
      topic: 'order-events',
      messages: [
        {
          key: orderId.toString(),
          value: JSON.stringify({
            orderId,
            itemId,
            quantity,
            price: itemPrice
          })
        }
      ]
    });
    console.log(`OrderCreated event published for order ${orderId}`);
  } catch (err) {
    console.error('Failed to publish order event to Kafka:', err.message);
  }

  res.status(201).json(confirmedOrder);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Order Service running on port ${PORT}`);
});
// Mock Fixed
