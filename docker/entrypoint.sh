#!/bin/sh
set -e

echo "================================================"
echo "Waiting for blockchain node to be ready..."
echo "================================================"

# Wait for blockchain with timeout
TIMEOUT=60
COUNT=0
while [ $COUNT -lt $TIMEOUT ]; do
  if nc -z blockchain 8545 2>/dev/null; then
    echo "✓ Blockchain node is ready!"
    echo ""
    break
  fi
  COUNT=$((COUNT + 1))
  echo "Waiting... ($COUNT/$TIMEOUT seconds)"
  sleep 1
done

if [ $COUNT -eq $TIMEOUT ]; then
  echo "ERROR: Blockchain node failed to start within $TIMEOUT seconds"
  exit 1
fi

echo "================================================"
echo "Starting contract deployment..."
echo "================================================"
echo ""

# Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

echo ""
echo "================================================"
echo "Deployment process completed!"
echo "================================================"
echo "Check deployments/local.json for contract addresses"
echo "RPC endpoint: http://localhost:8545"
echo "================================================"

# Keep container running
tail -f /dev/null
