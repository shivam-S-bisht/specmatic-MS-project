set -e

: "${ORDER_API_KEY:?ORDER_API_KEY is not set}"
: "${PAYMENT_SERVICE_TOKEN:?PAYMENT_SERVICE_TOKEN is not set}"

cat <<EOF
{
  "OrderFulfilmentEndToEnd": {
    "DEFAULT": {
      "orderApiKey": "${ORDER_API_KEY}"
    }
  },
  "DownstreamContractsOfOrderService": {
    "DEFAULT": {
      "paymentAuthorization": "Bearer ${PAYMENT_SERVICE_TOKEN}"
    }
  },
  "OrderCancellationSecurity": {
    "DEFAULT": {
      "orderApiKey": "${ORDER_API_KEY}"
    }
  }
}
EOF
