import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Trophy, Award, User, Target } from 'lucide-react';
import { colors, shadows } from '../styles/neo-brutal-theme';
import WalletConnect from './WalletConnect';
import NotificationBell from './NotificationBell';

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { to: '/', label: 'Home', icon: <Home className="h-6 w-6" /> },
    { to: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="h-6 w-6" /> },
    { to: '/wins', label: 'My Wins', icon: <Award className="h-6 w-6" /> },
    { to: '/profile', label: 'Profile', icon: <User className="h-6 w-6" /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        style={{
          background: colors.primary,
          border: `4px solid ${colors.border}`,
          boxShadow: shadows.brutalSmall,
          padding: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" style={{ color: colors.dark }} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 999,
              }}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '85vw',
                maxWidth: '400px',
                background: colors.background,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutalLarge,
                zIndex: 1000,
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px',
                  }}
                >
                  <h2
                    className="text-brutal"
                    style={{
                      fontSize: '28px',
                      color: colors.dark,
                    }}
                  >
                    MENU
                  </h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(false)}
                    style={{
                      background: colors.accent3,
                      border: `4px solid ${colors.border}`,
                      boxShadow: shadows.brutalSmall,
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="Close menu"
                  >
                    <X className="h-6 w-6" style={{ color: colors.white }} />
                  </motion.button>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <WalletConnect />
                  </div>
                  <NotificationBell />
                </div>

                <nav>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {menuItems.map((item, index) => {
                      const active = isActive(item.to);
                      return (
                        <motion.li
                          key={item.to}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          style={{ marginBottom: '12px' }}
                        >
                          <Link
                            to={item.to}
                            onClick={() => setIsOpen(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '16px',
                              padding: '20px',
                              background: active ? colors.primary : colors.white,
                              border: `4px solid ${colors.border}`,
                              boxShadow: active ? shadows.brutal : shadows.brutalSmall,
                              textDecoration: 'none',
                              color: colors.dark,
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontWeight: 900,
                              fontSize: '18px',
                              textTransform: 'uppercase',
                              transition: 'all 0.2s',
                              transform: active ? 'rotate(-1deg)' : 'rotate(0deg)',
                            }}
                          >
                            {item.icon}
                            {item.label}
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                </nav>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    marginTop: '32px',
                    padding: '20px',
                    background: colors.accent2,
                    border: `4px solid ${colors.border}`,
                    boxShadow: shadows.brutalSmall,
                  }}
                >
                  <h3
                    className="text-brutal"
                    style={{
                      fontSize: '16px',
                      marginBottom: '8px',
                      color: colors.dark,
                    }}
                  >
                    ABOUT STACKMATE
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      lineHeight: 1.5,
                      color: colors.dark,
                    }}
                  >
                    Solve chess puzzles, compete against others, and win STX prizes on the Stacks blockchain.
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
