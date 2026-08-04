const fs = require('fs');
const { Kafka } = require('kafkajs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const READY_FILE = process.env.READY_FILE || '/tmp/ready';

// Initialize Kafka Consumer
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [KAFKA_BROKER]
});
const consumer = kafka.consumer({ groupId: 'notification-group' });

let consuming = false;
async function startConsumer() {
  while (!consuming) {
    try {
      console.log(`Notification Service connecting to Kafka at ${KAFKA_BROKER}...`);
      await consumer.connect();
      await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const val = JSON.parse(message.value.toString());
            console.log('Received order event:', val);
            const { orderId } = val;
            if (orderId) {
              console.log(`[NOTIFICATION ALERT] Order ${orderId} has been successfully processed! Sending notification email...`);
            }
          } catch (e) {
            console.error('Error parsing order event message:', e.message);
          }
        }
      });
      console.log('Notification Service Kafka Consumer is running!');
      fs.writeFileSync(READY_FILE, 'ready');
      consuming = true;
    } catch (err) {
      console.error('Failed to connect Kafka consumer:', err.message);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
startConsumer();
