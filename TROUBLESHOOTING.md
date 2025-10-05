# 🔧 Troubleshooting: Frontend Not Showing Puzzles

## Issue
You successfully called `create-puzzle` on the contract, but the frontend doesn't show any puzzles.

## Root Causes & Solutions

### 1. Missing Environment Configuration ❌ (MOST COMMON)

**Problem:** The frontend doesn't know which contract to query.

**Solution:** Create a `.env` file in the project root:

```bash
# .env
VITE_CONTRACT_TESTNET=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool
VITE_CONTRACT_MAINNET=SP000000000000000000002Q6VF78.puzzle-pool
```

Replace `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM` with **your actual deployed contract address**.

**After creating `.env`, restart your dev server:**
```bash
npm run dev
# or
bun run dev
```

---

### 2. Difficulty Stakes Not Initialized ⚠️

**Problem:** The contract requires difficulty stakes to be set before creating puzzles.

Looking at line 127-130 in `puzzle-pool.clar`:
```clarity
(stake-amount (get-stake-for-difficulty difficulty))
...
(asserts! (> stake-amount u0) err-invalid-difficulty)
```

**Solution:** Initialize stakes in your contract using the contract owner wallet:

```clarity
;; Call these functions from Stacks Explorer or your wallet:
(contract-call? .puzzle-pool set-difficulty-stake "beginner" u500000)      ;; 0.5 STX
(contract-call? .puzzle-pool set-difficulty-stake "intermediate" u2000000) ;; 2 STX  
(contract-call? .puzzle-pool set-difficulty-stake "expert" u5000000)       ;; 5 STX
```

**Where to call these:**
- Stacks Explorer: https://explorer.stacks.co/sandbox/contract-call/
- Hiro Wallet: Contract Call tab
- Leather Wallet: Contract Interaction

---

### 3. Puzzle Not Actually Active 🔍

**Problem:** The puzzle was created but isn't marked as active.

**Check:** Run the diagnostic script:
```bash
cd /project/workspace/Anthonyushie/Stackmate
VITE_CONTRACT_TESTNET=<your-address>.puzzle-pool node scripts/test-contract.mjs
```

This will show:
- Total puzzles created
- Which puzzles are active
- Full details of each puzzle

---

### 4. Network Mismatch 🌐

**Problem:** Your wallet is on testnet but contract is on mainnet (or vice versa).

**Solution:** Ensure your wallet network matches the contract deployment:
- Testnet contracts start with `ST`
- Mainnet contracts start with `SP`

Check your wallet network in the Hiro/Leather wallet settings.

---

## Quick Diagnostic Checklist

Run through these steps:

- [ ] **Step 1:** Create `.env` file with correct contract address
- [ ] **Step 2:** Restart dev server (`npm run dev` or `bun run dev`)
- [ ] **Step 3:** Run diagnostic: `node scripts/test-contract.mjs`
- [ ] **Step 4:** Verify difficulty stakes are initialized
- [ ] **Step 5:** Check wallet is on correct network (testnet vs mainnet)
- [ ] **Step 6:** Open browser console (F12) and check for errors
- [ ] **Step 7:** Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

---

## Testing the Connection

### Manual Test in Browser Console:

```javascript
// Open browser console (F12) and run:
const contract = import.meta.env.VITE_CONTRACT_TESTNET;
console.log('Contract configured:', contract);

// If undefined or error, .env is not loaded properly
```

### Using the Diagnostic Script:

```bash
# From project root
VITE_CONTRACT_TESTNET=ST1234567890.puzzle-pool node scripts/test-contract.mjs
```

Expected output:
```
✅ Total puzzles created: 3
✅ Puzzle 1 is ACTIVE
✅ Puzzle 2 is ACTIVE
✅ Found 2 active puzzle(s)
```

---

## Expected Frontend Behavior

Once configured correctly:

1. **Home page** should show 3 puzzle cards (Beginner, Intermediate, Expert)
2. **Each card** should show:
   - Entry fee (0.5, 2, or 5 STX)
   - Prize pool (accumulated from entries)
   - Number of players
   - Time remaining (countdown)
3. **"Enter Puzzle"** button should be clickable

---

## Still Having Issues?

Check the browser console for specific errors:

### Common Errors:

**Error:** `Missing contract id env var`
- **Fix:** Create `.env` file with contract addresses

**Error:** `Puzzle not found` or `err-not-found`
- **Fix:** Initialize difficulty stakes first

**Error:** `Network request failed`
- **Fix:** Check internet connection and Stacks API status

**Error:** Contract calls timeout
- **Fix:** Try switching Stacks API endpoint or wait for network to stabilize

---

## Contract Owner Checklist

Before puzzles will work, you must:

1. ✅ Deploy `puzzle-pool.clar` contract
2. ✅ Initialize difficulty stakes (3 transactions)
3. ✅ Create at least one puzzle with `create-puzzle`
4. ✅ Configure frontend `.env` with deployed address
5. ✅ Restart dev server

---

## Need More Help?

1. Run the diagnostic script and share the output
2. Check browser console (F12 → Console tab) for errors
3. Verify your contract address on Stacks Explorer
4. Ensure you're using the correct network (testnet/mainnet)
