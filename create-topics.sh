#!/bin/sh
set -e

# Wait for Kafka broker to be ready
until /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list > /dev/null 2>&1; do
  echo 'Kafka not ready yet, retrying in 2s...'
  sleep 2
done

echo 'Creating order-events topic...'

/opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 \
  --create --if-not-exists \
  --topic order-events \
  --partitions 3 \
  --replication-factor 1

echo 'order-events topic creation done.'
