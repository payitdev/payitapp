# Send Flow Fix: Token Routing by Chain

## Problem
When a user wants to send tokens out to external addresses, the send flow should:
1. **Only show tokens supported by NEAR Intent for the destination chain**
2. **Prevent users from trying to send unsupported token-chain combinations**
3. **Route Base USDC through NEAR Intent 1Click to swap into destination tokens**

Currently, `getDestinationCryptoAssets()` returns static matrix regardless of the NEAR Intent support matrix, causing silent failures.

## Solution

### 1. Backend: New Endpoint to Get Sendable Assets per Chain
Create `/api/transfers/sendable-assets/:destinationChain` endpoint that:
- Queries NEAR Intent's supported tokens  
- Filters for tokens that can be sent FROM base:usdc TO {destination}:{asset}
- Returns only valid send routes

### 2. Frontend: Use Live Sendable Assets Matrix
Replace static `supportedCryptoRouteMatrix` with dynamic lookup that:
- Calls backend to get sendable assets for selected destination chain
- Only shows tokens user can actually send (not silent failures)
- Validates route before submit

### 3. Backend: Validate Send Route
Update send endpoint to:
- Verify base:usdc → destination:asset route exists in NEAR Intent
- Reject unsupported routes with clear error message
- Route through NEAR Intent 1Click for all cross-chain sends

## Files to Modify
1. `apps/backend/src/routes/transfers.ts` - Add sendable assets endpoint
2. `apps/mobile-web/src/App.tsx` - Use dynamic assets for send flow
3. `packages/integrations/src/nearIntentsClient.ts` - Expose sendable tokens helper

## Status: READY FOR IMPLEMENTATION
