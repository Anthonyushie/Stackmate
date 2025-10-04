import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import WalletConnect from './WalletConnect';
import NotificationBell from './NotificationBell';
import { colors, shadows } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';

export default function Header() {
  return (
    <header className="flex items-center justify-between mb-10 sm:mb-16 flex-wrap gap-4">
      <motion.div
        initial={{ rotate: -2, x: -20, opacity: 0 }}
        animate={{ rotate: 2, x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        style={{
          background: colors.primary,
          border: `6px solid ${colors.border}`,
          boxShadow: shadows.brutal,
          padding: '16px 32px',
        }}
      >
        <Link 
          to="/" 
          className="text-brutal" 
          style={{ 
            fontSize: 'clamp(24px, 5vw, 32px)', 
            color: colors.dark, 
            textDecoration: 'none',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
          }}
        >
          STACKMATE
        </Link>
      </motion.div>

      <div className="flex items-center gap-3">
        <Link to="/leaderboard">
          <NeoButton variant="secondary" size="sm">
            <Trophy className="inline h-4 w-4 mr-2" />
            LEADERBOARD
          </NeoButton>
        </Link>
        <NotificationBell />
        <WalletConnect />
      </div>
    </header>
  );
}
