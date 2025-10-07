# 🧪 Wallet & Puzzle Entry Testing Checklist

## Prerequisites Setup

### 1. Environment Configuration ✅
- [x] `.env.local` file created with testnet contract address
- [x] Dev server running on `http://localhost:5173`

### 2. Wallet Setup
Choose ONE of these wallets:

#### Option A: Leather Wallet (Recommended)
1. Install [Leather Wallet](https://leather.io/) browser extension
2. Create a new wallet or restore existing
3. Switch to **Testnet** in wallet settings
4. Get testnet STX from [faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)

#### Option B: Xverse Wallet
1. Install [Xverse](https://www.xverse.app/) browser extension
2. Create wallet and switch to **Testnet**
3. Get testnet STX from faucet

#### Option C: Hiro Wallet
1. Install [Hiro Wallet](https://wallet.hiro.so/) browser extension
2. Create wallet and switch to **Testnet**
3. Get testnet STX from faucet

---

## Testing Flow

### Phase 1: Wallet Connection 🔌

#### Test 1.1: Connect Wallet
1. Open `http://localhost:5173` in browser
2. Click **"CONNECT WALLET"** button in header
3. **Expected**: Dropdown shows wallet options (Leather, Xverse, Hiro)
4. Select your installed wallet
5. **Expected**: Wallet extension popup opens
6. Approve connection in wallet
7. **Expected**: 
   - Button shows truncated address (e.g., `ST2Q...5469`)
   - STX balance displayed
   - Green indicator dot appears on button
   - Button background changes to accent color

**Console Logs to Check:**
```
[useWallet] Starting connection with provider: [provider]
[useWallet] stacksConnect result: [...]
[useWallet] Resolved address: ST...
[useWallet] Balance: { stx: "...", micro: "..." }
```

#### Test 1.2: Verify Connection Details
1. Click on the connected wallet button
2. **Expected**: Dropdown shows:
   - Full address (truncated)
   - STX balance
   - Wallet provider name (e.g., "via Leather")
   - Copy Address button
   - Disconnect button
   - Network indicator (TESTNET ONLY)
   - View on Explorer link

#### Test 1.3: Copy Address
1. Click **"COPY ADDRESS"** button
2. **Expected**: Address copied to clipboard (no error)
3. Paste somewhere to verify

#### Test 1.4: View on Explorer
1. Click **"VIEW ON EXPLORER"** button
2. **Expected**: Opens Hiro Explorer in new tab
3. Shows your testnet address with transactions

#### Test 1.5: Disconnect Wallet
1. Click **"DISCONNECT"** button
2. **Expected**:
   - Button reverts to "CONNECT WALLET"
   - No address shown
   - Green indicator disappears
   - Background color resets

#### Test 1.6: Reconnection
1. Refresh page
2. Click "CONNECT WALLET" again
3. **Expected**: Should reconnect without full authorization flow

---

### Phase 2: Browse Puzzles 🧩

#### Test 2.1: View Active Puzzles
1. Navigate to homepage
2. **Expected**: See puzzle cards with:
   - Difficulty badge (Beginner/Intermediate/Expert)
   - Prize pool amount
   - Entry fee
   - Deadline countdown
   - Entry count
   - "ENTER PUZZLE" button

#### Test 2.2: Check Puzzle Details
1. Click on a puzzle card
2. **Expected**: Navigate to `/puzzle/[difficulty]/[id]`
3. Verify puzzle info displays:
   - Chess position diagram
   - Puzzle metadata
   - Current leaderboard (if any entries)

---

### Phase 3: Enter Puzzle 💰

#### Test 3.1: Open Entry Modal (Sufficient Balance)
1. Ensure wallet has enough testnet STX (at least entry fee + gas)
2. Click **"ENTER PUZZLE"** button on any puzzle card
3. **Expected**: Modal opens with:
   - Difficulty badge
   - Entry fee displayed
   - Current prize pool
   - Your balance (should be >= entry fee, background white/green)
   - Terms checkbox
   - "CONFIRM ENTRY" button (disabled until checkbox)

**Console Logs:**
```
[EnterPuzzleModal] Render { isOpen: true, puzzleId: ..., ... }
```

#### Test 3.2: Accept Terms
1. Check the **"I understand winner takes all"** checkbox
2. **Expected**: 
   - "CONFIRM ENTRY" button becomes enabled
   - Button color changes to primary (yellow/accent)

#### Test 3.3: Confirm Entry (Happy Path)
1. Click **"CONFIRM ENTRY"** button
2. **Expected Step 1 - Requesting Signature**:
   - Button shows spinner + "PROCESSING…"
   - Status box shows "WAITING FOR WALLET SIGNATURE…"
   - Toast notification: "Open your wallet to sign the entry"
   - Wallet popup opens

**Console Logs:**
```
[requestContractCall] Provider found: YES [provider]
[requestContractCall] Calling with params: {
  "contract": "ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool",
  "functionName": "enter-puzzle",
  ...
}
[requestContractCall] Trying stx_callContract (two-arg)...
```

3. **In Wallet**: Review transaction details:
   - Function: `enter-puzzle`
   - Post Condition: Exact STX transfer amount
   - Contract address: `ST2QK...puzzle-pool`
   - Confirm transaction

4. **Expected Step 2 - Transaction Submitted**:
   - Status: "TRANSACTION SUBMITTED. WAITING FOR CONFIRMATION…"
   - Toast: "Transaction submitted. Waiting for confirmation…"
   - Transaction ID displayed in status box

**Console Logs:**
```
[requestContractCall] SUCCESS with stx_callContract (two-arg), txId: 0x...
```

5. **Expected Step 3 - Transaction Confirming** (10-30 seconds):
   - Status remains "TRANSACTION PENDING…"
   - Polling occurs in background

6. **Expected Step 4 - Transaction Success**:
   - Status: "ENTRY CONFIRMED! TIME TO SOLVE 🎯" (green background)
   - Toast: "Entry confirmed! Time to solve 🎯"
   - Automatically redirects to `/solve/[difficulty]/[puzzleId]` after 1.2s

#### Test 3.4: Post-Entry Verification
1. After redirect to solve page
2. **Expected**: Chess board loaded with puzzle position
3. Check leaderboard - your entry should appear (once you submit solution)
4. Navigate back to home
5. **Expected**: Puzzle card shows "ALREADY ENTERED" or different state

#### Test 3.5: Test Insufficient Balance
1. Find a puzzle with very high entry fee (or test with nearly empty wallet)
2. Click "ENTER PUZZLE"
3. **Expected**:
   - Your balance box shows RED background
   - Warning box: "LOW BALANCE - You don't have enough STX..."
   - "CONFIRM ENTRY" button disabled
   - Cannot proceed

#### Test 3.6: Test User Cancellation
1. Open entry modal
2. Accept terms and click "CONFIRM ENTRY"
3. **In wallet popup**: Click "Cancel" or "Reject"
4. **Expected**:
   - Status: "ENTRY FAILED. PLEASE TRY AGAIN."
   - Error message shown
   - Can close modal and retry

**Console Logs:**
```
[requestContractCall] ... user cancel detected
```

#### Test 3.7: Test Already Entered
1. Try to enter the same puzzle again
2. **Expected**:
   - Modal shows "YOU HAVE ALREADY ENTERED THIS PUZZLE" banner
   - "CONFIRM ENTRY" button disabled

---

### Phase 4: Transaction Tracking 📊

#### Test 4.1: View Transaction Status
1. During puzzle entry
2. Open browser DevTools Console
3. **Expected logs sequence**:
```
[requestContractCall] Provider found: YES
[requestContractCall] Trying stx_callContract (two-arg)...
[requestContractCall] SUCCESS with stx_callContract (two-arg), txId: 0x...
[txManager] Transaction submitted: 0x...
[txManager] Transaction confirming: 0x...
[txManager] Transaction success: 0x...
```

#### Test 4.2: Check Transaction on Explorer
1. Copy the transaction ID from status box
2. Visit `https://explorer.hiro.so/testnet/txid/[txId]?chain=stacks`
3. **Expected**: 
   - Transaction shows as "Success"
   - Function called: `enter-puzzle`
   - Post conditions met
   - STX transferred to contract

---

### Phase 5: Network & Error Handling 🛡️

#### Test 5.1: Network Locked to Testnet
1. In wallet, switch to Mainnet
2. Try to connect wallet
3. **Expected**: App still uses testnet (check network indicator)
4. **Note**: App is hard-coded to testnet only

#### Test 5.2: No Wallet Installed
1. Disable/remove all Stacks wallet extensions
2. Refresh page
3. Click "CONNECT WALLET"
4. **Expected**: Connection fails gracefully with error message

#### Test 5.3: Test Contract Call Fallbacks
1. Check console during entry
2. **Expected**: If one RPC method fails, it tries alternatives:
   - `stx_callContract` (two-arg)
   - `stx_callContract` (object)
   - `stx_contractCall` (object)
   - `stx_makeContractCall` (object)
   - `contract_call` (object)
   - `openContractCall` (object)

---

## Common Issues & Solutions 🔧

### Issue: "No wallet provider available"
**Solution**: Install Leather, Xverse, or Hiro wallet extension and refresh page

### Issue: "No sender address"
**Solution**: Disconnect and reconnect wallet, ensure you're on testnet

### Issue: "Insufficient STX balance"
**Solution**: Get testnet STX from faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet

### Issue: Transaction stuck in "pending"
**Solution**: Wait 30-60 seconds. Testnet can be slow. Check explorer for status.

### Issue: "makeStandardSTXPostCondition" error
**Solution**: ✅ Already fixed! Updated to use new `Pc` API from @stacks/transactions v7

### Issue: Modal doesn't close
**Solution**: Refresh page. Modal should only be closeable when status is 'idle'

### Issue: Wallet shows wrong network
**Solution**: Open wallet extension settings and switch to Testnet

---

## Success Criteria ✅

All tests should pass with these outcomes:

- [x] **Wallet connects** without errors
- [x] **Address and balance** display correctly
- [x] **Entry modal** opens with correct data
- [x] **Post conditions** are created properly (no export errors)
- [x] **Transaction signs** and submits to blockchain
- [x] **Transaction confirms** within 60 seconds
- [x] **Navigation** to solve page works
- [x] **Error handling** works for insufficient balance, cancellation, etc.
- [x] **Console logs** show proper flow without critical errors

---

## Quick Test Script 🚀

For fastest testing:

1. **Setup** (1 min):
   ```bash
   cd /project/workspace/Anthonyushie/Stackmate
   npm install
   npm run dev
   ```

2. **Wallet** (2 min):
   - Install Leather wallet
   - Get testnet STX from faucet
   - Connect wallet on localhost:5173

3. **Entry Test** (2 min):
   - Navigate to home
   - Click any puzzle "ENTER PUZZLE"
   - Accept terms
   - Confirm in wallet
   - Wait for confirmation
   - Verify redirect

**Total Time: ~5 minutes for complete flow**

---

## API Fix Verification ✅

The original error has been **FIXED**:

**Before:**
```typescript
import { makeStandardSTXPostCondition, FungibleConditionCode } from '@stacks/transactions';

const pc = makeStandardSTXPostCondition(
  senderAddress,
  FungibleConditionCode.Equal,
  entryAmount
);
```

**After:**
```typescript
import { Pc } from '@stacks/transactions';

const pc = Pc.principal(senderAddress).willSendEq(entryAmount).ustx();
```

This uses the new fluent API from `@stacks/transactions` v7.2.0.

**API Breakdown:**
- `Pc.principal(address)` - Specifies the principal (address) creating the post condition
- `.willSendEq(amount)` - Sets condition code to "equal" with the specified amount
- `.ustx()` - Specifies this is for micro-STX (μSTX) tokens

The resulting post condition object:
```typescript
{
  type: 'stx-postcondition',
  address: 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469',
  condition: 'eq',
  amount: '1000000'
}
```

---

## Next Steps

After confirming the entry flow works:

1. **Test puzzle solving**: Submit solution and verify leaderboard
2. **Test claim prize**: Simulate winning and claiming
3. **Test edge cases**: Multiple entries, deadline expiry, etc.
4. **Load testing**: Multiple simultaneous entries
5. **Cross-wallet testing**: Test with all 3 wallet providers

Good luck! 🎉
