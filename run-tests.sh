#!/bin/sh
set -e

# Define file paths
EVENTS_API_PATH="/usr/src/app/contracts/events-api.yaml"
ORDER_SPEC_PATH="/usr/src/app/order-service/specmatic.yaml"
SHIPPING_SPEC_PATH="/usr/src/app/shipping-service/specmatic.yaml"
NOTIFICATION_SPEC_PATH="/usr/src/app/notification-service/specmatic.yaml"

# Create temp backups of configurations to avoid massive heredocs
mkdir -p /tmp/specmatic-backup
cp "$EVENTS_API_PATH" /tmp/specmatic-backup/events-api.yaml
cp "$ORDER_SPEC_PATH" /tmp/specmatic-backup/order-specmatic.yaml
cp "$SHIPPING_SPEC_PATH" /tmp/specmatic-backup/shipping-specmatic.yaml
cp "$NOTIFICATION_SPEC_PATH" /tmp/specmatic-backup/notification-specmatic.yaml

cleanup() {
  echo "Restoring configuration files..."
  cp /tmp/specmatic-backup/events-api.yaml "$EVENTS_API_PATH"
  cp /tmp/specmatic-backup/order-specmatic.yaml "$ORDER_SPEC_PATH"
  cp /tmp/specmatic-backup/shipping-specmatic.yaml "$SHIPPING_SPEC_PATH"
  cp /tmp/specmatic-backup/notification-specmatic.yaml "$NOTIFICATION_SPEC_PATH"
  rm -rf /tmp/specmatic-backup
}
trap cleanup EXIT INT TERM

echo "========================================="
echo "1. Running Inventory Service Contract Tests"
echo "========================================="
cd /usr/src/app/inventory-service
specmatic test

echo "========================================="
echo "2. Running Payment Service Contract Tests"
echo "========================================="
cd /usr/src/app/payment-service
specmatic test

echo "========================================="
echo "3. Running Order Service Contract Tests"
echo "========================================="
cd /usr/src/app/order-service
specmatic test

# Wait for Kafka consumer group rebalance and message propagation to Shipping Service
echo "Waiting 15 seconds for Kafka event propagation..."
sleep 15

echo "========================================="
echo "4. Running Shipping Service Contract Tests"
echo "========================================="
cd /usr/src/app/shipping-service
specmatic test

echo "========================================="
echo "5. Running Notification Service Contract Tests"
echo "========================================="
cd /usr/src/app/notification-service
specmatic test --filter "OPERATION-ID=subscribeOrderCreated"

echo "========================================="
echo "6. Running Arazzo Integration Workflow Tests"
echo "========================================="
# Temporary delete configurations to isolate Arazzo workflow execution
rm -f "$EVENTS_API_PATH"
rm -f "$ORDER_SPEC_PATH"
rm -f "$SHIPPING_SPEC_PATH"
rm -f "$NOTIFICATION_SPEC_PATH"

cd /usr/src/app
specmatic test /usr/src/app/contracts/place-order.arazzo.yaml --baseUrl=http://order-service:3000 --debug

echo "========================================="
echo "All Microservice Contract & Workflow Tests Passed!"
echo "========================================="
