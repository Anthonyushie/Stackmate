# 🚀 Quick Setup Instructions

## What You Need to Provide

From your successful `create-puzzle` transaction, please provide:

1. **Contract Address** - Format: `ST...` (testnet) or `SP...` (mainnet)
2. **Network** - Are you using `testnet` or `mainnet`?

You can find this in:
- Your Stacks Explorer transaction URL
- Your wallet's transaction history
- The contract deployment confirmation

Example contract address: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.puzzle-pool`

---

## Setup Steps

### Step 1: Create `.env` file

Create a file named `.env` in the project root:

```bash
VITE_CONTRACT_TESTNET=YOUR_CONTRACT_ADDRESS_HERE.puzzle-pool
VITE_CONTRACT_MAINNET=SP000000000000000000002Q6VF78.puzzle-pool
```

Replace `YOUR_CONTRACT_ADDRESS_HERE` with your actual contract address.

### Step 2: Verify Contract Configuration

Before puzzles will show, you MUST initialize the difficulty stakes. This is a one-time setup.

Go to **Stacks Explorer** or your wallet and call these functions **as the contract owner**:

```clarity
;; Set beginner stake (0.5 STX = 500,000 microSTX)
(contract-call? .puzzle-pool set-difficulty-stake "beginner" u500000)

;; Set intermediate stake (2 STX = 2,000,000 microSTX)
(contract-call? .puzzle-pool set-difficulty-stake "intermediate" u2000000)

;; Set expert stake (5 STX = 5,000,000 microSTX)
(contract-call? .puzzle-pool set-difficulty-stake "expert" u5000000)
```

**Important:** Without these stakes, `create-puzzle` will fail with `err-invalid-difficulty`

### Step 3: Test the Connection

Run the diagnostic script:

```bash
node scripts/test-contract.mjs
```

Or with explicit contract:

```bash
VITE_CONTRACT_TESTNET=ST1234.puzzle-pool node scripts/test-contract.mjs
```

### Step 4: Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
# or
bun run dev
```

### Step 5: Open the Frontend

Navigate to `http://localhost:5173` (or your dev server URL)

You should now see your puzzles! 🎉

---

## Example Transaction Flow

Here's the complete flow to get puzzles showing:

### 1. Deploy Contract (DONE ✅)
```clarity
;; Deploy puzzle-pool.clar to Stacks
```

### 2. Initialize Stakes (REQUIRED ⚠️)
```clarity
;; One-time setup - run these 3 transactions
(contract-call? .puzzle-pool set-difficulty-stake "beginner" u500000)
(contract-call? .puzzle-pool set-difficulty-stake "intermediate" u2000000)
(contract-call? .puzzle-pool set-difficulty-stake "expert" u5000000)
```

### 3. Create Puzzles (YOU DID THIS ✅)
```clarity
;; Create a puzzle - you already did this!
(contract-call? .puzzle-pool create-puzzle 
  "beginner" 
  0x1234567890... 
  u1000)
```

### 4. Configure Frontend (NEXT STEP 🎯)
```bash
# Create .env with your contract address
echo "VITE_CONTRACT_TESTNET=ST123....puzzle-pool" > .env
```

### 5. Restart Server
```bash
npm run dev
```

---

## Verification Checklist

- [ ] Contract deployed successfully
- [ ] Difficulty stakes initialized (3 transactions)  
- [ ] At least one puzzle created
- [ ] `.env` file created with correct contract address
- [ ] Dev server restarted
- [ ] Browser refreshed (hard refresh: Ctrl+Shift+R)
- [ ] Check browser console for errors (F12)

---

## Expected Result

Once everything is set up, your home page will display:

### Puzzle Cards
- **Beginner** - 0.5 STX entry fee
- **Intermediate** - 2 STX entry fee  
- **Expert** - 5 STX entry fee

Each card shows:
- Prize pool
- Number of players
- Time remaining
- Your best time (if you've entered)
- "Enter Puzzle" button

---

## Troubleshooting

If puzzles still don't show:

1. **Run diagnostic script** - See what the contract returns
   ```bash
   node scripts/test-contract.mjs
   ```

2. **Check browser console** - Press F12 and look for errors

3. **Verify wallet network** - Make sure wallet is on correct network

4. **Hard refresh** - Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

5. **Check .env is loaded**
   - Open browser console (F12)
   - Type: `import.meta.env.VITE_CONTRACT_TESTNET`
   - Should show your contract address

---

## Quick Copy-Paste Setup

If you're using **testnet** with contract `ST1EXAMPLE123.puzzle-pool`:

```bash
# 1. Create .env
cat > .env << 'EOF'
VITE_CONTRACT_TESTNET=ST1EXAMPLE123.puzzle-pool
VITE_CONTRACT_MAINNET=SP000000000000000000002Q6VF78.puzzle-pool
EOF

# 2. Test connection
VITE_CONTRACT_TESTNET=ST1EXAMPLE123.puzzle-pool node scripts/test-contract.mjs

# 3. Restart server
npm run dev
```

Replace `ST1EXAMPLE123` with your actual contract address!

---

## Next Steps

Once you see puzzles on the frontend:

1. ✅ **Users can enter puzzles** - Click "Enter Puzzle" and stake STX
2. ✅ **Users can solve puzzles** - Navigate to solve page
3. ✅ **Leaderboard works** - Shows fastest solvers
4. ✅ **Winners can claim prizes** - After deadline passes

Your dApp is fully functional! 🎉
