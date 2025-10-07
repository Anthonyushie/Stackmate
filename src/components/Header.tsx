import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, Network } from 'lucide-react';
import WalletConnect from './WalletConnect';
import NotificationBell from './NotificationBell';
import MobileMenu from './MobileMenu';
import { colors, shadows } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';

export default function Header() {
  return (
    <header className="flex items-center justify-between mb-10 sm:mb-16 gap-4">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <motion.div
          initial={{ rotate: -2, x: -20, opacity: 0 }}
          animate={{ rotate: 2, x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          style={{
            background: colors.primary,
            border: `6px solid ${colors.border}`,
            boxShadow: shadows.brutal,
            padding: '12px 20px',
          }}
          className="sm:px-8"
        >
          <Link 
            to="/" 
            className="text-brutal" 
            style={{ 
              fontSize: 'clamp(18px, 5vw, 32px)', 
              color: colors.dark, 
              textDecoration: 'none',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            STACKMATE
          </Link>
        </motion.div>
        
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
          className="hidden sm:flex"
          style={{
            background: colors.intermediate,
            border: `4px solid ${colors.border}`,
            boxShadow: shadows.brutalSmall,
            padding: '8px 16px',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Network className="h-4 w-4" />
          <span style={{ 
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900, 
            fontSize: '14px', 
            textTransform: 'uppercase' 
          }}>
            TESTNET
          </span>
        </motion.div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link to="/leaderboard" className="hidden lg:block">
          <NeoButton variant="secondary" size="sm">
            <Trophy className="inline h-4 w-4 mr-2" />
            LEADERBOARD
          </NeoButton>
        </Link>
        <div className="hidden md:block">
          <NotificationBell />
        </div>
        <div className="hidden md:block">
          <WalletConnect />
        </div>
        <div className="md:hidden">
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
