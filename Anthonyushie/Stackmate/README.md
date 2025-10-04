# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

## Smart contract setup and verification

### 1) Environment variables
Create a `.env.local` file in the project root (Vite reads env at dev-time):

```
VITE_CONTRACT_TESTNET=ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool
VITE_CONTRACT_MAINNET=SPXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.puzzle-pool
```

- Use the exact format: `address.contractName`
  - Testnet addresses start with `ST…`
  - Mainnet addresses start with `SP…`
- Restart the dev server after editing env:

```
npm run dev
```

### 2) Network selection
- Click "Connect Wallet" and choose Leather/Xverse/Hiro.
- Use the wallet dropdown to switch between Testnet and Mainnet.
- The app automatically prefers `ST…` addresses on testnet and `SP…` on mainnet.

### 3) On‑chain data the app reads
- Active puzzles: `get-puzzle-count`, `is-puzzle-active`
- Puzzle info: `get-puzzle-info` (prizePool, stakeAmount, entryCount, deadline, winner, isActive)
- User entry: `get-entry` (disables Enter button if already entered)
- Leaderboard: scans contract_call `submit-solution` via Hiro API
- Chain height: `GET /v2/info` (used for countdowns)

### 4) Verify in DevTools (Network tab)
- Read‑only calls (POST, JSON body):
  - `/v2/contracts/call-read` for `get-puzzle-info`, `is-puzzle-active`, `get-entry`, `get-user-stats`
- Leaderboard (GET):
  - `/extended/v1/address/{CONTRACT_ADDRESS}/transactions?limit=200`
- Chain info (GET):
  - `/v2/info`
- Entering a puzzle:
  - Wallet opens to sign `enter-puzzle`
  - App then polls `/extended/v1/tx/{txid}` for status

### 5) Quick smoke test
With `VITE_CONTRACT_TESTNET` set and wallet on Testnet:
- Home shows difficulty cards with prize pool, players, countdown
- Clicking Enter prompts the wallet; after success, the button shows `ENTERED`
- Solve page (`/solve/:difficulty/:puzzleId`) shows live leaderboard and on‑chain prize pool

### 6) Troubleshooting
- Empty cards / no active puzzles:
  - Ensure your contract has active puzzles and correct IDs configured
- Read calls failing:
  - Verify env vars, network selection, and `address.contractName` formatting
- Wallet popup not appearing:
  - Unlock wallet and ensure it’s on the same network as the app
- Vite module errors:
  - Remove `node_modules` and `package-lock.json`, run `npm cache clean --force`, then `npm install`
