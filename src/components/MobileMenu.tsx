import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { X, Home, Trophy, Award, User, Menu } from 'lucide-react';
import { colors, shadows } from '../styles/neo-brutal-theme';
import { useState } from 'react';
import WalletConnect from './WalletConnect';
import NotificationBell from './NotificationBell';

interface MobileMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { path: '/', label: 'HOME', icon: Home },
  { path: '/leaderboard', label: 'LEADERBOARD', icon: Trophy },
  { path: '/wins', label: 'MY WINS', icon: Award },
  { path: '/profile', label: 'PROFILE', icon: User },
];

export function MobileMenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      style={{
        background: colors.primary,
        border: `4px solid ${colors.border}`,
        boxShadow: shadows.brutalSmall,
        padding: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 60,
      }}
      aria-label="Toggle menu"
    >
      {isOpen ? (
        <X className="h-6 w-6" style={{ color: colors.dark }} />
      ) : (
        <Menu className="h-6 w-6" style={{ color: colors.dark }} />
      )}
    </motion.button>
  );
}

export default function MobileMenu({ isOpen, onToggle }: MobileMenuProps) {
  const location = useLocation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 50,
            }}
            onClick={onToggle}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '85%',
              maxWidth: '400px',
              background: colors.background,
              border: `6px solid ${colors.border}`,
              borderRight: 'none',
              boxShadow: shadows.brutal,
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}
          >
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div
                style={{
                  marginBottom: '32px',
                  paddingBottom: '24px',
                  borderBottom: `4px solid ${colors.border}`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <WalletConnect />
                  <NotificationBell />
                </div>
              </div>

              <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {menuItems.map((item, index) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={item.path}
                        onClick={onToggle}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px 20px',
                          background: isActive ? colors.primary : colors.white,
                          border: `4px solid ${colors.border}`,
                          boxShadow: shadows.brutalSmall,
                          textDecoration: 'none',
                          color: colors.dark,
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 900,
                          fontSize: '18px',
                          textTransform: 'uppercase',
                          letterSpacing: '-0.02em',
                          transform: isActive ? 'scale(1.05)' : 'scale(1)',
                          transition: 'transform 0.2s',
                        }}
                      >
                        <Icon className="h-6 w-6" />
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  marginTop: '32px',
                  padding: '20px',
                  background: colors.accent1,
                  border: `4px solid ${colors.border}`,
                  boxShadow: shadows.brutalSmall,
                  transform: 'rotate(-1deg)',
                }}
              >
                <p
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    color: colors.dark,
                    lineHeight: 1.5,
                  }}
                >
                  Solve chess puzzles, compete with others, and win STX prizes!
                </p>
              </motion.div>
            </div>

            <div
              style={{
                padding: '20px 24px',
                background: colors.dark,
                borderTop: `4px solid ${colors.border}`,
              }}
            >
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  fontSize: '12px',
                  color: colors.primary,
                  textAlign: 'center',
                }}
              >
                STACKMATE © 2024
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
