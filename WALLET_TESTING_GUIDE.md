# 🔥 Wallet Connect Testing Guide

## Quick Start

Your dev server is running at: **http://localhost:5173/**

## Prerequisites

### 1. Install a Stacks Wallet Extension

You need ONE of these browser extensions:

#### **Hiro Wallet** (Recommended for beginners)
- Chrome: https://chrome.google.com/webstore/detail/hiro-wallet/ldinpeekobnhjjdofggfgjlcehhmanlj
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/hiro-wallet/

#### **Xverse Wallet**
- Chrome: https://chrome.google.com/webstore/detail/xverse-wallet/idnnbdplmphpflfnlkomgpfbpcgelopg

#### **Leather Wallet** (formerly Hiro Wallet)
- Chrome: https://chrome.google.com/webstore/detail/leather/ldinpeekobnhjjdofggfgjlcehhmanlj

### 2. Set Up Your Wallet
1. Install the extension
2. Create a new wallet OR import an existing one
3. Save your seed phrase securely (NEVER share it!)
4. Choose a password

## Testing Steps

### Step 1: Open the App
1. Navigate to http://localhost:5173/ in your browser
2. You should see the Stackmate header with a yellow "Connect Wallet" button

### Step 2: Connect Your Wallet
1. Click the **"Connect Wallet"** button
2. A pink dropdown will appear with wallet options (Hiro, Xverse, Leather)
3. Click your installed wallet
4. Your wallet extension popup will open
5. **Review the connection request** and click "Connect" or "Approve"

### Step 3: Verify Connection
Once connected, you should see:
- ✅ Your truncated Stacks address (e.g., `ST1ABC...XYZ9`)
- ✅ Your STX balance (may show 0.000000 if no funds)
- ✅ Current network (testnet by default)
- ✅ Connected wallet name

### Step 4: Test Features

#### **View Wallet Details**
- Click the connected wallet button (shows your address + balance)
- A dropdown menu will appear with:
  - Your full address and balance
  - "Copy address" button
  - "Disconnect" button
  - Network toggle (Testnet/Mainnet)
  - "View on explorer" link

#### **Copy Address**
1. Click "Copy address" in the dropdown
2. Paste somewhere to verify it copied correctly

#### **Switch Networks**
1. Click either "Testnet" or "Mainnet" in the dropdown
2. Your balance will refresh for the selected network
3. The active network has a black ring around it

#### **View on Explorer**
1. Click "View on explorer"
2. Opens Hiro Explorer in a new tab showing your address

#### **Disconnect**
1. Click "Disconnect"
2. Wallet should disconnect
3. Button returns to "Connect Wallet" state

### Step 5: Test Reconnection
1. Refresh the page
2. The wallet should auto-detect your previous connection
3. Click "Connect Wallet" again to reconnect

## Getting Testnet STX

To test with actual balance:

1. **Switch to Testnet** (if not already)
2. **Copy your address** from the wallet
3. **Get testnet STX** from the faucet:
   - https://explorer.hiro.so/sandbox/faucet?chain=testnet
   - Paste your address
   - Click "Request STX"
4. **Wait 1-2 minutes** for the transaction to confirm
5. **Refresh** the page or click the wallet button to see updated balance

## Troubleshooting

### "No wallet detected" or connection fails
- ✅ Make sure your wallet extension is installed and unlocked
- ✅ Refresh the page
- ✅ Try a different browser or incognito mode
- ✅ Check browser console for errors (F12 → Console)

### Balance shows "—" or "0"
- ✅ You might not have any STX on that network
- ✅ Try switching networks (testnet ↔ mainnet)
- ✅ Request testnet STX from the faucet (see above)
- ✅ Wait a few seconds, balance fetches in background

### Network switch doesn't update balance
- ✅ Click the wallet button again to refresh
- ✅ Check browser console for API errors
- ✅ Hiro API might be slow, wait 10-20 seconds

### Button shows "Connecting…" forever
- ✅ Check if wallet popup was blocked by your browser
- ✅ Refresh the page and try again
- ✅ Make sure wallet extension is unlocked

### Wallet provider not listed
- ✅ Only Hiro, Xverse, and Leather are currently supported
- ✅ Make sure the wallet supports `@stacks/connect`

## What's Being Tested

### ✅ Wallet Connection (`@stacks/connect`)
- Multi-wallet provider selection
- Connection flow via wallet popup
- Address resolution from provider

### ✅ Network Configuration
- Testnet (default)
- Mainnet
- API base URLs from `src/lib/stacks.ts`

### ✅ State Management (Zustand)
- `useWallet` hook in `src/hooks/useWallet.ts`
- Persistent wallet state across component rerenders

### ✅ Balance Fetching
- Real-time STX balance from Hiro API
- `fetchStxBalance()` in `src/lib/stacks.ts`
- Micro-STX → STX conversion

### ✅ UI/UX (Neo-Brutalist)
- Framer Motion animations
- TailwindCSS styling
- Provider dropdown
- Connected state dropdown
- Loading states

## Next Steps

Once everything works:
1. ✅ Test on different browsers (Chrome, Firefox, Brave)
2. ✅ Test with different wallets (Hiro, Xverse, Leather)
3. ✅ Test network switching multiple times
4. ✅ Test disconnect → reconnect flow
5. ✅ Test with mainnet wallet (use with caution, real STX!)

## Developer Notes

### Inspecting State
Open browser console and run:
```js
// Check if wallet provider is available
window.HiroWalletProvider || window.XverseProviders || window.LeatherProvider

// Check @stacks/connect
window.StacksProvider
```

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "balances"
4. You should see requests to `api.testnet.hiro.so` or `api.hiro.so`

### Debugging Wallet Issues
Check the console for:
- `@stacks/connect` logs
- Provider errors
- API fetch errors
- Zustand state updates

---

## ⚡ Support

If something doesn't work:
1. Check the browser console (F12 → Console)
2. Share the error message
3. Specify which wallet you're using
4. Note which network (testnet/mainnet)

Happy testing! 🚀
