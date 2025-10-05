# 🎯 Frontend Not Showing Puzzles - SOLUTION

## Problem Summary
You successfully called `create-puzzle` on your contract, but the frontend doesn't display the puzzles.

## Root Cause
**The frontend has no `.env` configuration file** telling it which contract to query.

---

## ⚡ QUICK FIX (5 minutes)

### Option 1: Interactive Setup (Recommended)
```bash
node scripts/setup-env.mjs
```
Follow the prompts to enter your contract address.

### Option 2: Manual Setup
1. Create `.env` file in project root:
   ```bash
   touch .env
   ```

2. Add your contract address:
   ```
   VITE_CONTRACT_TESTNET=ST_YOUR_ADDRESS_HERE.puzzle-pool
   VITE_CONTRACT_MAINNET=SP_YOUR_ADDRESS_HERE.puzzle-pool
   ```

3. Restart dev server:
   ```bash
   npm run dev
   ```

---

## 📋 Complete Setup Checklist

### ✅ Step 1: Configure Environment
- [ ] Create `.env` file with your contract address
- [ ] Run: `node scripts/setup-env.mjs` (interactive)
  - OR manually create `.env` with your contract address

### ✅ Step 2: Initialize Contract Stakes (ONE-TIME)

**IMPORTANT:** Before puzzles work, you MUST set difficulty stakes in your contract.

Call these functions from Stacks Explorer or your wallet **as contract owner**:

```clarity
;; Beginner: 0.5 STX
(contract-call? .puzzle-pool set-difficulty-stake "beginner" u500000)

;; Intermediate: 2 STX
(contract-call? .puzzle-pool set-difficulty-stake "intermediate" u2000000)

;; Expert: 5 STX
(contract-call? .puzzle-pool set-difficulty-stake "expert" u5000000)
```

**Why?** The contract checks `get-stake-for-difficulty` and requires it to be > 0:
```clarity
;; From puzzle-pool.clar line 130
(asserts! (> stake-amount u0) err-invalid-difficulty)
```

### ✅ Step 3: Verify Setup
```bash
node scripts/test-contract.mjs
```

Expected output:
```
✅ Total puzzles created: 1
✅ Puzzle 1 is ACTIVE
✅ Contract connection successful!
```

### ✅ Step 4: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
# or
bun run dev
```

### ✅ Step 5: Verify in Browser
1. Open http://localhost:5173
2. You should see puzzle cards with:
   - Entry fees (0.5, 2, 5 STX)
   - Prize pools
   - Player counts
   - Countdown timers

---

## 🔍 Diagnostics

### Test Contract Connection
```bash
VITE_CONTRACT_TESTNET=ST123.puzzle-pool node scripts/test-contract.mjs
```

### Check Browser Console
1. Open browser (http://localhost:5173)
2. Press F12 → Console tab
3. Type: `import.meta.env.VITE_CONTRACT_TESTNET`
4. Should show your contract address (not undefined)

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Missing contract id env var" | No `.env` file | Create `.env` with contract address |
| "err-invalid-difficulty" | Stakes not initialized | Call `set-difficulty-stake` 3 times |
| "Puzzle not found" | Wrong contract address | Verify address in `.env` |
| Puzzles show as "inactive" | Deadline passed or manually deactivated | Create new puzzle |
| Network errors | Wrong network | Check wallet network matches contract |

---

## 📝 What You Need

From your successful `create-puzzle` transaction, find:

1. **Contract Address** - e.g., `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`
2. **Contract Name** - e.g., `puzzle-pool`
3. **Network** - `testnet` or `mainnet`

Combine as: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool`

Find this in:
- Stacks Explorer transaction details
- Your wallet transaction history
- Contract deployment receipt

---

## 🚀 Full Example

Let's say your contract is `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool` on testnet:

### 1. Create .env
```bash
cat > .env << 'EOF'
VITE_CONTRACT_TESTNET=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool
VITE_CONTRACT_MAINNET=SP000000000000000000002Q6VF78.puzzle-pool
EOF
```

### 2. Test connection
```bash
node scripts/test-contract.mjs
```

### 3. Initialize stakes (in Stacks Explorer)
```clarity
(contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool 
  set-difficulty-stake "beginner" u500000)

(contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool 
  set-difficulty-stake "intermediate" u2000000)

(contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool 
  set-difficulty-stake "expert" u5000000)
```

### 4. Create puzzle (you already did this!)
```clarity
(contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool 
  create-puzzle 
  "beginner" 
  0xabcd1234567890... 
  u1000)
```

### 5. Restart server
```bash
npm run dev
```

### 6. Open browser
Navigate to http://localhost:5173

**You should now see your puzzle!** 🎉

---

## 🆘 Still Not Working?

1. **Run diagnostics:** `node scripts/test-contract.mjs`
2. **Check browser console:** F12 → Console tab
3. **Verify wallet network:** Testnet vs Mainnet
4. **Hard refresh browser:** Ctrl+Shift+R or Cmd+Shift+R
5. **Check .env loaded:** `import.meta.env.VITE_CONTRACT_TESTNET` in console

Read full troubleshooting guide: `TROUBLESHOOTING.md`

---

## 📚 Resources Created

- `TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
- `SETUP_INSTRUCTIONS.md` - Detailed setup walkthrough  
- `scripts/setup-env.mjs` - Interactive .env configuration
- `scripts/test-contract.mjs` - Contract connection diagnostics
- `.env.example` - Template environment file

---

## ✅ Success Criteria

Your frontend is working when you see:

- ✅ 3 puzzle cards (Beginner, Intermediate, Expert)
- ✅ Entry fees displayed (0.5, 2, 5 STX)
- ✅ Prize pools shown
- ✅ Player counts visible
- ✅ Countdown timers running
- ✅ "Enter Puzzle" buttons clickable
- ✅ No errors in browser console

---

## 🎮 Next Steps After Setup

Once puzzles are showing:

1. **Connect Wallet** - Click "Connect Wallet" button
2. **Enter Puzzle** - Click "Enter Puzzle" on any difficulty
3. **Stake STX** - Approve the transaction in your wallet
4. **Solve Puzzle** - Navigate to solve page and play
5. **Submit Solution** - Complete the puzzle and submit
6. **Win Prize** - If you're fastest, claim your prize after deadline!

---

**Need help?** Drop your contract address and I'll help you set it up! 🚀
