# Deposit Idempotency Implementation Plan

## Current Status
✅ **Completed:**
- Added `depositSyncCursors` table to schema (Block height + TX hash tracking per entity/network)
- Imported cursor table in transfers route
- Full monorepo build passes ✓

🔄 **In Progress:** Wiring cursor logic into active sync functions

⚠️ **Known Risk:** Current balance-based deposit detection can process the same funds multiple times if NEAR Intent funding fails or sync runs twice before first settlement completes.

---

## Problem Context

### Current Deposit Detection (Problematic)
**EVM** (Ethereum, Base, Polygon, etc.):
- Uses `eth_getLogs` with fixed 100,000-block lookback every sync
- **Deduplication:** Only via `dueTransferId` unique constraint
- **Risk:** If MPC signing fails after log scan but before transfer commit, same log gets rescanned and can create duplicate transfer records

**Solana:**
- Detects deposits by checking wallet balance > 0.0001 SOL
- **Deduplication:** Uses `balanceSnapshot` + amount in refTag
- **Risk:** Same balance swept multiple times if sync runs twice before first settlement publishes or if funding fails mid-way

**Bitcoin:**
- Detects deposits by checking wallet balance > 0.00001 BTC
- **Deduplication:** Loose (mempool-based, address + amount in refTag)
- **Risk:** UTXO reorg or mempool invalidation can cause resweeping

**NEAR:**
- Detects deposits by checking wallet balance > 0.06 NEAR
- **Deduplication:** Balance + timestamp in refTag
- **Risk:** Same balance swept twice if sync runs before previous settlement confirmation

### New Deposit Detection (After This Implementation)
- **Track by transaction:** Each network's sync uses `lastProcessedBlockHeight` and optionally `lastProcessedTxHash`
- **One scan per block range:** No 100k-block overlap; only process new blocks since last cursor
- **Atomic updates:** Cursor advances only after successful settlement or dueTransferId insert
- **Result:** Same transaction never processed twice (transaction hash already in dueTransferId table)

---

## Implementation Steps

### Phase 1: Add Cursor Helper Functions
Add to [transfers.ts](apps/backend/src/routes/transfers.ts) before `syncEvmUsdcDeposits`:

```typescript
// Helper: Get or create deposit sync cursor for entity + network
async function getOrCreateDepositCursor(entityId: string, network: string) {
  const key = `${entityId}:${network}`;
  let cursor = await db.select().from(depositSyncCursors)
    .where(and(eq(depositSyncCursors.entityId, entityId), eq(depositSyncCursors.network, network)))
    .limit(1);
  
  if (cursor.length === 0) {
    const id = `cursor_${network}_${entityId}`.slice(0, 50);
    await db.insert(depositSyncCursors).values({
      id,
      entityId,
      network,
      lastProcessedBlockHeight: '0',
      lastProcessedTxHash: undefined,
      lastProcessedAt: new Date(),
      updatedAt: new Date(),
      createdAt: new Date(),
    }).onConflictDoNothing(); // Idempotent creation
    return { id, entityId, network, lastProcessedBlockHeight: '0', lastProcessedTxHash: undefined };
  }
  return cursor[0];
}

// Helper: Update cursor after successful deposit processing
async function updateDepositCursor(entityId: string, network: string, blockHeight: string, txHash?: string) {
  await db.update(depositSyncCursors).set({
    lastProcessedBlockHeight: blockHeight,
    lastProcessedTxHash: txHash,
    lastProcessedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(depositSyncCursors.entityId, entityId), eq(depositSyncCursors.network, network)));
}
```

---

### Phase 2: Refactor EVM Deposit Sync (Parallel Approach)

**Goal:** Instead of fixed 100k-block lookback, resume from `lastProcessedBlockHeight`

```typescript
async function syncEvmUsdcDeposits(entityId: string): Promise<void> {
  const entityRows = await db.select().from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  const address = entityRows[0]?.evmDepositAddress;
  if (!address) return;

  const recipientTopic = `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;

  await Promise.allSettled(evmUsdcNetworks.map(async (network) => {
    try {
      const rpc = async (method: string, params: unknown[]) => {
        const response = await fetch(network.rpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(3500),
          body: JSON.stringify({ jsonrpc: '2.0', id: `${network.name}-deposit-sync`, method, params }),
        });
        const body = await response.json() as { result?: any };
        return body.result;
      };

      // ===== CHANGE: Use cursor instead of fixed lookback =====
      const cursor = await getOrCreateDepositCursor(entityId, network.name);
      const latestBlock = BigInt(await rpc('eth_blockNumber', []));
      const fromBlock = BigInt(cursor.lastProcessedBlockHeight || '0');
      
      // Safety: Don't scan more than 100k blocks at once
      const scanFromBlock = latestBlock > (fromBlock + 100000n) ? latestBlock - 100000n : fromBlock;

      const logs = await rpc('eth_getLogs', [{
        address: network.token,
        fromBlock: `0x${scanFromBlock.toString(16)}`,
        toBlock: `0x${latestBlock.toString(16)}`,
        topics: [erc20TransferTopic, null, recipientTopic],
      }]) as Array<{ transactionHash: string; data: string; blockNumber: string }> | undefined;

      // Track max block seen in this scan
      let maxBlockSeen = scanFromBlock;

      for (const log of logs || []) {
        const amount = Number(BigInt(log.data)) / 10 ** network.decimals;
        if (!Number.isFinite(amount) || amount <= 0) continue;
        
        const reference = `evm_${network.symbol.toLowerCase()}_${network.name}_${log.transactionHash}`;
        const existing = await db.select().from(transfers)
          .where(eq(transfers.dueTransferId, reference))
          .limit(1);
        
        if (existing.length > 0) {
          // Already processed; update cursor if this block is newer
          const blockNum = BigInt(log.blockNumber || '0');
          if (blockNum > maxBlockSeen) maxBlockSeen = blockNum;
          continue;
        }

        const entity = entityRows[0];
        if (!entity.evmDepositAddress) continue;

        const settlement = await createPendingIntentSettlement({
          entityId,
          reference,
          originAsset: `${network.name}:${network.symbol.toLowerCase()}`,
          originAmount: amount,
          recipientAddress: entity.evmDepositAddress,
        });

        let fundingTxHash: string;
        try {
          fundingTxHash = await fundIntentFromEvm({
            entity,
            network,
            tokenAmount: BigInt(log.data),
            intentDepositAddress: settlement.intentId,
            relatedTransactionId: reference,
          });
          await nearIntentsClient.submitDepositTxHash({
            intentId: settlement.intentId,
            txHash: fundingTxHash,
            chain: network.name,
          });
          await db.update(intentSwaps).set({
            sourceTxHash: fundingTxHash,
            status: 'SUBMITTED',
          }).where(eq(intentSwaps.id, settlement.swapId));

          // Update cursor after successful processing
          const blockNum = BigInt(log.blockNumber || '0');
          if (blockNum > maxBlockSeen) maxBlockSeen = blockNum;
        } catch (fundingError: any) {
          await db.update(intentSwaps).set({
            status: 'FAILED',
            failureReason: `MPC Intent funding failed: ${fundingError.message}`,
          }).where(eq(intentSwaps.id, settlement.swapId));
          
          // Still record transfer attempt for dedup, but mark it failed
          await db.insert(transfers).values({
            id: ulid(),
            // ... existing fields ...
            dueTransferId: reference,
            status: 'FAILED',
          }).onConflictDoNothing();
        }
      }

      // ===== CHANGE: Update cursor after scan completes =====
      if (maxBlockSeen > scanFromBlock) {
        await updateDepositCursor(entityId, network.name, maxBlockSeen.toString());
      }
    } catch (err: any) {
      console.error(`[Deposit Sync] EVM ${network.name} error for ${entityId}:`, err.message);
    }
  }));
}
```

---

### Phase 3: Refactor Solana Deposit Sync

**Goal:** Track transactions by signature instead of balance sweep

```typescript
// In syncOnChainActivityAndBalance, replace Solana balance-check block:

async function syncSolanaDeposits(entityId: string) {
  try {
    const entityRows = await db.select().from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);
    
    const solanaPubkey = entityRows[0]?.solanaDepositAddress;
    if (!solanaPubkey) return;

    const cursor = await getOrCreateDepositCursor(entityId, 'solana');
    const lastProcessedSignature = cursor.lastProcessedTxHash;

    // Query signatures after cursor
    const sigResponse = await fetch(`${process.env.SOLANA_RPC_URL}`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [solanaPubkey, { limit: 100, before: lastProcessedSignature }],
      }),
    }).then(r => r.json());

    const signatures = sigResponse.result || [];
    let lastSeenSignature = lastProcessedSignature;

    for (const sig of signatures) {
      const txHash = sig.signature;
      if (sig.err) continue; // Skip failed txs

      // Check if already processed
      const reference = `sol_${txHash}`;
      const existing = await db.select().from(transfers)
        .where(eq(transfers.dueTransferId, reference))
        .limit(1);
      
      if (existing.length > 0) {
        lastSeenSignature = txHash;
        continue;
      }

      // Fetch transaction details
      const txResponse = await fetch(`${process.env.SOLANA_RPC_URL}`, {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [txHash, { encoding: 'json' }],
        }),
      }).then(r => r.json());

      const tx = txResponse.result;
      if (!tx) continue;

      // Parse token transfer amount from tx instructions
      // (Logic depends on tx structure; simplified here)
      const postTokenBalances = tx.meta?.postTokenBalances || [];
      const solAmount = tx.meta?.postBalances?.reduce((acc: any, _: any) => acc, 0) || 0;
      
      if (solAmount <= 0.0001) continue; // Skip dust

      // Create settlement
      const settlement = await createPendingIntentSettlement({
        entityId,
        reference,
        originAsset: 'solana:sol',
        originAmount: solAmount,
        recipientAddress: entityRows[0].solanaDepositAddress,
      });

      try {
        // Fund Intent with SOL (converted to USDC via NEAR)
        const fundingTxHash = await fundIntentFromSolana({
          entity: entityRows[0],
          amount: solAmount,
          intentId: settlement.intentId,
          relatedTransactionId: reference,
        });

        await nearIntentsClient.submitDepositTxHash({
          intentId: settlement.intentId,
          txHash: fundingTxHash,
          chain: 'solana',
        });

        await db.update(intentSwaps).set({
          sourceTxHash: fundingTxHash,
          status: 'SUBMITTED',
        }).where(eq(intentSwaps.id, settlement.swapId));

        lastSeenSignature = txHash;
      } catch (err: any) {
        // Mark as failed
        await db.update(intentSwaps).set({
          status: 'FAILED',
          failureReason: err.message,
        }).where(eq(intentSwaps.id, settlement.swapId));
      }
    }

    // Update cursor
    if (lastSeenSignature && lastSeenSignature !== lastProcessedSignature) {
      await updateDepositCursor(entityId, 'solana', '0', lastSeenSignature);
    }
  } catch (err: any) {
    console.error(`[Deposit Sync] Solana error for ${entityId}:`, err.message);
  }
}
```

---

### Phase 4: Test and Validation

1. **Unit Tests:**
   - Verify cursor creation for new entity/network pairs
   - Verify cursor updates after successful deposit
   - Verify deposits are not re-processed when cursor is current

2. **Integration Tests:**
   - Simulate Solana deposit → verify cursor advances by transaction hash
   - Simulate EVM deposit → verify cursor advances by block height
   - Simulate failed deposit → verify cursor does NOT advance
   - Simulate rapid consecutive sync calls → verify no duplicate transfers

3. **Database Migration:**
   - Deploy `depositSyncCursors` table to dev/staging
   - Initialize cursor for all existing entities (backfill to latest block height)
   - Run sync functions and verify cursor is updated

4. **End-to-End Test:**
   - Send real deposit from test wallet
   - Verify transfer recorded with cursor-based detection (not balance-based)
   - Verify fee calculation is 1% with $0.50-$50 bounds
   - Verify fee transfer succeeds to Base treasury address
   - Re-run sync and verify no duplicate transfer created

---

## Dependency Order

1. ✅ **Schema:** `depositSyncCursors` table added
2. ✅ **Import:** Cursor table imported in transfers route
3. 🔄 **Helper Functions:** Add cursor CRUD functions (Phase 1)
4. 🔄 **EVM Sync:** Refactor `syncEvmUsdcDeposits()` to use cursor (Phase 2)
5. 🔄 **Solana Sync:** Refactor `syncOnChainActivityAndBalance()` Solana branch (Phase 3)
6. 🔄 **Bitcoin/NEAR:** Refactor Bitcoin and NEAR branches with similar pattern
7. 🔄 **Testing:** Integration test suite for cursor behavior
8. 🔄 **Migration:** DB migration + cursor initialization for production
9. 🔄 **Validation:** Full end-to-end test with real deposits

---

## Summary

This implementation replaces **balance-based** deposit detection (vulnerable to re-processing) with **transaction-based** detection using durable cursors. Each sync call will:

1. Query last processed block/tx from `depositSyncCursors`
2. Fetch only NEW transactions since last cursor
3. Check `dueTransferId` unique constraint to skip already-processed txs
4. After processing, advance cursor to latest block/tx seen
5. Result: Same deposit never processed twice, even if sync runs multiple times or Intent funding fails

**Estimated Effort:** 6-8 hours for full implementation + testing  
**Risk Level:** Low (cursor is advisory; dueTransferId constraint provides hard dedup)  
**Benefit:** Eliminates duplicate deposit risk; enables reliable retry logic
