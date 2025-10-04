import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import useNotifications from '../hooks/useNotifications';
import { formatRelativeTime } from '../lib/time-utils';
import { colors, shadows } from '../styles/neo-brutal-theme';
import NeoButton from './neo/NeoButton';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, enableSound, enableDesktop, desktopPermission, setEnableSound, setEnableDesktop } = useNotifications();
  const [open, setOpen] = useState(false);

  const top = useMemo(() => notifications.slice(0, 10), [notifications]);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          background: colors.white,
          border: `4px solid ${colors.border}`,
          boxShadow: shadows.brutal,
          cursor: 'pointer',
        }}
      >
        <Bell className="h-5 w-5" style={{ color: colors.dark }} />
        
        {/* MASSIVE unread indicator */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: colors.error,
              color: colors.white,
              fontSize: '14px',
              fontWeight: 900,
              padding: '4px 8px',
              border: `3px solid ${colors.border}`,
              boxShadow: shadows.brutalSmall,
              minWidth: '28px',
              textAlign: 'center',
            }}
          >
            {unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              position: 'absolute',
              right: 0,
              marginTop: '12px',
              width: '360px',
              background: colors.white,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutalLarge,
              zIndex: 50,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              borderBottom: `3px solid ${colors.border}`,
              background: colors.accent1,
            }}>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '18px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                }}>
                  NOTIFICATIONS
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '8px',
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                    <input 
                      type="checkbox" 
                      checked={enableSound} 
                      onChange={(e) => setEnableSound(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    Sound
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                    <input 
                      type="checkbox" 
                      checked={enableDesktop} 
                      onChange={(e) => setEnableDesktop(e.target.checked)} 
                      disabled={desktopPermission === 'denied' || desktopPermission === 'unsupported'}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    Desktop
                  </label>
                  {desktopPermission === 'denied' && (
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>(blocked)</span>
                  )}
                </div>
              </div>
              {unreadCount > 0 && (
                <NeoButton variant="primary" size="sm" onClick={() => markAllAsRead()}>
                  MARK READ
                </NeoButton>
              )}
            </div>

            {/* Notifications list */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {top.length === 0 && (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  fontSize: '14px',
                  opacity: 0.7,
                  fontWeight: 700,
                }}>
                  No notifications
                </div>
              )}
              {top.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => markAsRead(n.id)}
                  style={{
                    padding: '16px',
                    borderBottom: `2px solid ${colors.border}`,
                    background: !n.read ? colors.primary : colors.white,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    fontWeight: 900,
                    fontSize: '14px',
                    marginBottom: '4px',
                  }}>
                    {n.message}
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    opacity: 0.6,
                  }}>
                    {formatRelativeTime(n.createdAt)}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 16px',
              borderTop: `3px solid ${colors.border}`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              opacity: 0.6,
              textAlign: 'center',
            }}>
              SHOWING LATEST 10
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
