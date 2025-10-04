import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { colors, shadows, animations } from '../../styles/neo-brutal-theme';
import NeoButton from './NeoButton';

interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  color?: string;
  maxWidth?: string;
}

export default function NeoModal({
  isOpen,
  onClose,
  children,
  title,
  color = colors.primary,
  maxWidth = '600px',
}: NeoModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -10, y: -100 }}
            animate={{ scale: 1, rotate: 2, y: 0 }}
            exit={{ scale: 0, rotate: 10, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: color,
              border: `6px solid ${colors.border}`,
              boxShadow: shadows.brutalLarge,
              maxWidth,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
            }}
          >
            <div style={{ padding: '32px', position: 'relative' }}>
              <button
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: colors.dark,
                  color: colors.white,
                  border: `3px solid ${colors.border}`,
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} strokeWidth={3} />
              </button>

              {title && (
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 900,
                    fontSize: '32px',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    marginBottom: '24px',
                    color: colors.dark,
                  }}
                >
                  {title}
                </h2>
              )}

              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
