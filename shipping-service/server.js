const express = require('express');
const actuatorMappings = require('./actuator');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Kafka } = require('kafkajs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const SWAGGER_PATH = process.env.SWAGGER_PATH || path.join(__dirname, '..', 'contracts', 'shipping-api.yaml');

// In-memory shipment DB
const shipments = {};

// Initialize Kafka Consumer
const kafka = new Kafka({
  clientId: 'shipping-service',
  brokers: [KAFKA_BROKER]
});
const consumer = kafka.consumer({ groupId: 'shipping-group' });

let consuming = false;
async function startConsumer() {
  while (!consuming) {
    try {
      console.log(`Shipping Service connecting to Kafka at ${KAFKA_BROKER}...`);
      await consumer.connect();
      await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const val = JSON.parse(message.value.toString());
            console.log('Received order event:', val);
            const { orderId } = val;
            if (orderId) {
              shipments[orderId] = {
                orderId: parseInt(orderId),
                trackingNumber: `TRACK-${1000 + parseInt(orderId)}`,
                status: 'SHIPPED'
              };
              console.log(`Scheduled shipment for order ${orderId}`);
            }
          } catch (e) {
            console.error('Error parsing order event message:', e.message);
          }
        }
      });
      console.log('Shipping Service Kafka Consumer is running!');
      consuming = true;
    } catch (err) {
      console.error('Failed to connect Kafka consumer:', err.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
startConsumer();

app.get('/actuator/mappings', actuatorMappings(app, 'shippingService'));

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

// GET /shipments/:orderId
app.get('/shipments/:orderId', (req, res) => {
  const idVal = parseInt(req.params.orderId);
  if (isNaN(idVal)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const shipment = shipments[idVal];
  if (!shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }
  res.json(shipment);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shipping Service running on port ${PORT}`);
});
