# 🚀 Quick Test Guide - Wallet & Puzzle Entry

## Status: ✅ READY TO TEST

The `makeStandardSTXPostCondition` import error has been **FIXED** and verified!

---

## Verification Results

### ✅ Automated Tests Passed
Run: `node scripts/test-post-conditions.mjs`

All 6 tests passed:
- ✅ Post condition creation with `Pc.principal().willSendEq().ustx()`
- ✅ Function argument encoding
- ✅ Post condition structure validation
- ✅ Multiple STX amounts (0.1 to 100 STX)
- ✅ Different address formats (testnet/mainnet)
- ✅ Origin post condition alternative

### ✅ TypeScript Compilation
Run: `npx tsc --noEmit`
- No errors found

### ✅ Dev Server
- Running on http://localhost:5173
- No build errors

---

## 5-Minute Test Flow

### Step 1: Setup Wallet (2 minutes)

1. **Install Leather Wallet** (recommended)
   - Go to https://leather.io/install-extension
   - Install browser extension
   - Create new wallet (save seed phrase!)

2. **Switch to Testnet**
   - Open Leather extension
   - Click settings (gear icon)
   - Select "Testnet" network

3. **Get Test STX**
   - Visit https://explorer.hiro.so/sandbox/faucet?chain=testnet
   - Paste your STX address
   - Request testnet STX (get at least 10 STX)
   - Wait 30-60 seconds for confirmation

### Step 2: Connect Wallet (1 minute)

1. **Open App**
   ```
   http://localhost:5173
   ```

2. **Connect**
   - Click "CONNECT WALLET" button (top right)
   - Select "Leather"
   - Approve connection in wallet popup

3. **Verify**
   - Button should show your address: `ST2Q...5469`
   - Shows STX balance: `10.0 STX`
   - Green indicator dot visible

### Step 3: Enter Puzzle (2 minutes)

1. **Navigate to Home**
   - Should see puzzle cards (Beginner/Intermediate/Expert)

2. **Click "ENTER PUZZLE"** on any puzzle
   - Modal opens with puzzle details
   - Shows: Difficulty, Entry Fee, Prize Pool, Your Balance

3. **Accept Terms**
   - Check "I understand winner takes all"
   - "CONFIRM ENTRY" button becomes enabled

4. **Confirm Entry**
   - Click "CONFIRM ENTRY"
   - Wallet popup opens **immediately**
   - Should show:
     - Function: `enter-puzzle`
     - Post Condition: STX transfer amount
     - Contract: `ST2QK...puzzle-pool`

5. **Sign Transaction**
   - Click "Confirm" in wallet
   - Wait for transaction to process (10-30 seconds)

6. **Success!**
   - Status shows: "ENTRY CONFIRMED! TIME TO SOLVE 🎯"
   - Auto-redirects to puzzle solve page
   - Chess board loads with puzzle position

---

## Expected Console Logs

### Good Flow (Success):
```
[useWallet] Starting connection with provider: LeatherProvider
[useWallet] stacksConnect result: {...}
[useWallet] Resolved address: ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469
[useWallet] Balance: { stx: "10.0", micro: "10000000" }
[EnterPuzzleModal] Render { isOpen: true, puzzleId: 1, ... }
[requestContractCall] Provider found: YES LeatherProvider
[requestContractCall] Calling with params: {
  "contract": "ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool",
  "functionName": "enter-puzzle",
  "functionArgs": ["0x0100000000000000000000000000000001"],
  "postConditionMode": "deny",
  "postConditions": [
    {
      "type": "stx-postcondition",
      "address": "ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469",
      "condition": "eq",
      "amount": "1000000"
    }
  ],
  "network": "testnet",
  "anchorMode": "any"
}
[requestContractCall] Trying stx_callContract (two-arg)...
[requestContractCall] SUCCESS with stx_callContract (two-arg), txId: 0xabcdef...
```

### Bad Flow (Old Error - Now Fixed):
```
❌ Uncaught SyntaxError: The requested module doesn't provide an export named: 'makeStandardSTXPostCondition'
```
**Status:** This error is now **FIXED** ✅

---

## What Was Fixed?

### The Problem
```typescript
// ❌ OLD CODE (doesn't work with @stacks/transactions v7)
import { makeStandardSTXPostCondition, FungibleConditionCode } from '@stacks/transactions';

const pc = makeStandardSTXPostCondition(
  senderAddress,
  FungibleConditionCode.Equal,
  entryAmount
);
```

The `makeStandardSTXPostCondition` function was removed in `@stacks/transactions` v7.x

### The Solution
```typescript
// ✅ NEW CODE (works with v7)
import { Pc } from '@stacks/transactions';

const pc = Pc.principal(senderAddress).willSendEq(entryAmount).ustx();
```

This creates the same post condition using the new fluent `Pc` builder API:
- `Pc.principal(address)` - sets the principal address
- `.willSendEq(amount)` - sets condition to "equal" with amount
- `.ustx()` - specifies micro-STX tokens

**Result:**
```json
{
  "type": "stx-postcondition",
  "address": "ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469",
  "condition": "eq",
  "amount": "1000000"
}
```

---

## Troubleshooting

### "No wallet provider available"
- Install Leather/Xverse/Hiro wallet extension
- Refresh page after installation

### "No sender address"
- Ensure wallet is on **Testnet** (not mainnet)
- Disconnect and reconnect wallet
- Check wallet has an active account

### "Insufficient STX balance"
- Get testnet STX from faucet
- Wait for faucet transaction to confirm (~30-60 seconds)

### "Transaction stuck in pending"
- Testnet can be slow, wait up to 2 minutes
- Check transaction on explorer: https://explorer.hiro.so/testnet

### Wallet popup doesn't open
- Check browser popup blocker
- Ensure wallet extension is unlocked
- Try refreshing page and reconnecting

---

## Files Changed

### `/src/lib/contracts.ts`
- Line 1: Import changed to use `Pc` instead of `makeStandardSTXPostCondition`
- Line 175: Post condition creation updated to new API

### Test Files Created
- `scripts/test-post-conditions.mjs` - Automated verification script
- `.env.local` - Environment configuration
- `WALLET_TESTING_CHECKLIST.md` - Comprehensive testing guide
- `QUICK_TEST_GUIDE.md` - This file

---

## Next Steps After Testing

Once you confirm wallet connection and puzzle entry work:

1. ✅ **Test Puzzle Solving**
   - Submit a solution after entering
   - Verify leaderboard updates

2. ✅ **Test Prize Claiming**
   - Win a puzzle (or simulate with contract)
   - Claim prize as winner

3. ✅ **Test Edge Cases**
   - Try entering twice (should be blocked)
   - Test with insufficient balance
   - Test user cancellation

4. ✅ **Cross-Wallet Testing**
   - Test with Xverse wallet
   - Test with Hiro wallet
   - Verify all work the same

5. ✅ **Deploy to Production**
   - Test on mainnet (with real STX!)
   - Update contract addresses in `.env.local`

---

## Resources

- **Stacks Explorer (Testnet):** https://explorer.hiro.so/testnet
- **Testnet Faucet:** https://explorer.hiro.so/sandbox/faucet?chain=testnet
- **Leather Wallet:** https://leather.io/
- **Xverse Wallet:** https://www.xverse.app/
- **Hiro Wallet:** https://wallet.hiro.so/
- **@stacks/transactions Docs:** https://stacks.js.org/

---

## Need Help?

Check the comprehensive guide: `WALLET_TESTING_CHECKLIST.md`

Or review the console logs - they're very detailed!

---

**Status:** ✅ Ready to test end-to-end  
**Dev Server:** ✅ Running on http://localhost:5173  
**TypeScript:** ✅ No errors  
**Tests:** ✅ All passing  

Happy testing! 🎉
