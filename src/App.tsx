import WalletConnect from './components/WalletConnect';
import useWallet from './hooks/useWallet';

export default function App() {
  const { address, balance, network, providerId, error } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-100 to-blue-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <h1 className="text-4xl font-black tracking-tight">
            🔥 Stackmate
          </h1>
          <WalletConnect />
        </header>

        <main className="rounded-none border-[3px] border-black shadow-[8px_8px_0_#000] bg-white p-8">
          <h2 className="text-2xl font-black mb-6">Wallet Status</h2>
          
          {error && (
            <div className="mb-6 bg-red-100 p-4 rounded-none border-2 border-red-600">
              <div className="text-xs font-bold uppercase tracking-wider text-red-800">Error</div>
              <div className="text-sm text-red-900 mt-1">{error}</div>
            </div>
          )}
          
          {address ? (
            <div className="space-y-4">
              <div className="bg-green-100 p-4 rounded-none border-2 border-black">
                <div className="text-xs font-bold uppercase tracking-wider opacity-60">Connected</div>
                <div className="font-mono text-sm mt-1">{address}</div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-100 p-4 rounded-none border-2 border-black">
                  <div className="text-xs font-bold uppercase">Balance</div>
                  <div className="text-2xl font-black">{balance?.stx ?? '—'}</div>
                  <div className="text-xs opacity-60">STX</div>
                </div>

                <div className="bg-blue-100 p-4 rounded-none border-2 border-black">
                  <div className="text-xs font-bold uppercase">Network</div>
                  <div className="text-2xl font-black">{network}</div>
                </div>

                <div className="bg-purple-100 p-4 rounded-none border-2 border-black">
                  <div className="text-xs font-bold uppercase">Wallet</div>
                  <div className="text-2xl font-black">{providerId ?? '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-100 p-6 rounded-none border-2 border-black text-center">
              <div className="text-lg font-bold mb-2">No wallet connected</div>
              <div className="text-sm opacity-70">Click "Connect Wallet" above to get started</div>
            </div>
          )}

          <div className="mt-8 pt-8 border-t-2 border-black">
            <h3 className="text-lg font-black mb-4">Testing Instructions</h3>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-black">1.</span>
                <span>Install a Stacks wallet extension (Hiro, Xverse, or Leather)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-black">2.</span>
                <span>Click "Connect Wallet" and choose your wallet</span>
              </li>
              <li className="flex gap-2">
                <span className="font-black">3.</span>
                <span>Approve the connection in your wallet popup</span>
              </li>
              <li className="flex gap-2">
                <span className="font-black">4.</span>
                <span>Your address and balance should appear above</span>
              </li>
            </ol>
          </div>
        </main>
      </div>
    </div>
  );
}
