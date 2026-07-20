#!/bin/sh
set -e

# Define file paths
EVENTS_API_PATH="/usr/src/app/contracts/events-api.yaml"
ORDER_SPEC_PATH="/usr/src/app/order-service/specmatic.yaml"
SHIPPING_SPEC_PATH="/usr/src/app/shipping-service/specmatic.yaml"
NOTIFICATION_SPEC_PATH="/usr/src/app/notification-service/specmatic.yaml"

# Helper function to restore all files on exit
cleanup() {
  echo "Running cleanup to restore configuration files..."
  
  cat << 'EOF' > "$EVENTS_API_PATH"
asyncapi: 3.0.0
info:
  title: Microservices Event Stream
  version: 1.0.0
  description: Event-driven updates for the distributed system
servers:
  localKafka:
    host: kafka:9092
    protocol: kafka
    description: Development Kafka Broker
channels:
  orderEvents:
    address: order-events
    messages:
      orderCreated:
        $ref: "#/components/messages/OrderCreated"
operations:
  publishOrderCreated:
    description: Publishes an event when a new order is confirmed
    action: send
    channel:
      $ref: "#/channels/orderEvents"
    messages:
      - $ref: "#/channels/orderEvents/messages/orderCreated"
  subscribeOrderCreated:
    description: Subscribes to order updates to trigger shipping and notifications
    action: receive
    channel:
      $ref: "#/channels/orderEvents"
    messages:
      - $ref: "#/channels/orderEvents/messages/orderCreated"
components:
  messages:
    OrderCreated:
      name: OrderCreated
      title: Order Created Event
      contentType: application/json
      payload:
        type: object
        required:
          - orderId
          - itemId
          - quantity
          - price
        properties:
          orderId:
            type: integer
          itemId:
            type: integer
          quantity:
            type: integer
          price:
            type: integer
EOF

  cat << 'EOF' > "$ORDER_SPEC_PATH"
version: 3

systemUnderTest:
  service:
    definitions:
      - definition:
          source:
            filesystem:
              directory: ../contracts
          specs:
            - spec:
                id: orderApiSpec
                path: order-api.yaml
    runOptions:
      openapi:
        type: test
        baseUrl: "http://order-service:3000"
        swaggerUrl: "http://order-service:3000/swagger.json"
        filter: "PATH!='/swagger.json'"
    settings:
      schemaResiliencyTests: all

dependencies:
  services:
    - service:
        definitions:
          - definition:
              source:
                filesystem:
                  directory: ../contracts
              specs:
                - inventory-api.yaml
        runOptions:
          openapi:
            type: mock
            baseUrl: "http://specmatic-test:9001"
        data:
          dictionary:
            path: ../contracts/dictionary.yaml
    - service:
        definitions:
          - definition:
              source:
                filesystem:
                  directory: ../contracts
              specs:
                - payment-api.yaml
        runOptions:
          openapi:
            type: mock
            baseUrl: "http://specmatic-test:9002"
    - service:
        definitions:
          - definition:
              source:
                filesystem:
                  directory: ../contracts
              specs:
                - events-api.yaml
        runOptions:
          asyncapi:
            type: mock
            servers:
              - host: "kafka:9092"
                protocol: kafka

specmatic:
  governance:
    successCriteria:
      minCoveragePercentage: 100
      maxMissedOperationsInSpec: 0
      enforce: true
  license:
    path: /specmatic/specmatic-license.txt
EOF

  cat << 'EOF' > "$SHIPPING_SPEC_PATH"
version: 3

systemUnderTest:
  service:
    definitions:
      - definition:
          source:
            filesystem:
              directory: ../contracts
          specs:
            - shipping-api.yaml
    runOptions:
      openapi:
        type: test
        baseUrl: "http://shipping-service:3003"
        swaggerUrl: "http://shipping-service:3003/swagger.json"
    settings:
      schemaResiliencyTests: all

dependencies:
  services:
    - service:
        definitions:
          - definition:
              source:
                filesystem:
                  directory: ../contracts
              specs:
                - events-api.yaml
        runOptions:
          asyncapi:
            type: mock
            servers:
              - host: "kafka:9092"
                protocol: kafka

specmatic:
  governance:
    successCriteria:
      minCoveragePercentage: 100
      maxMissedOperationsInSpec: 0
      enforce: true
  license:
    path: /specmatic/specmatic-license.txt
EOF

  cat << 'EOF' > "$NOTIFICATION_SPEC_PATH"
version: 3

systemUnderTest:
  service:
    definitions:
      - definition:
          source:
            filesystem:
              directory: ../contracts
          specs:
            - events-api.yaml
    runOptions:
      asyncapi:
        type: test
        servers:
          - host: "kafka:9092"
            protocol: kafka

specmatic:
  license:
    path: /specmatic/specmatic-license.txt
EOF

  echo "Restored configuration files successfully."
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

echo "========================================="
echo "4. Running Shipping Service Contract Tests"
echo "========================================="
cd /usr/src/app/shipping-service
specmatic test

echo "========================================="
echo "5. Running Arazzo Integration Workflow Tests"
echo "========================================="
# Delete events-api.yaml and service configs completely from workspace right before the test
rm -f "$EVENTS_API_PATH"
rm -f "$ORDER_SPEC_PATH"
rm -f "$SHIPPING_SPEC_PATH"
rm -f "$NOTIFICATION_SPEC_PATH"

cd /usr/src/app
specmatic test /usr/src/app/contracts/place-order.arazzo.yaml --baseUrl=http://order-service:3000 --debug

echo "========================================="
echo "All Microservice Contract & Workflow Tests Passed!"
echo "========================================="
