#!/bin/bash
pkill -f "next dev" || true
pkill -f "api-server" || true
sleep 2

PORT=3000 pnpm --filter @workspace/api-server run dev > api.log 2>&1 &
API_PID=$!
PORT=3001 pnpm --filter @workspace/storefront exec next dev -p 3001 --webpack > front.log 2>&1 &
FRONTEND_PID=$!

echo "Waiting for servers to start..."
sleep 15

export E2E_BASE_URL=http://localhost:3001
export E2E_CHROMIUM_PATH=/usr/bin/google-chrome
export E2E_LIVE_CHECKOUT=1

pnpm --filter @workspace/storefront exec playwright test --config=e2e/playwright.config.ts e2e/specs/core-funnel.spec.ts --project=chromium
TEST_EXIT_CODE=$?

kill $API_PID
kill $FRONTEND_PID

# kill lingering child processes
pkill -P $API_PID
pkill -P $FRONTEND_PID

exit $TEST_EXIT_CODE
