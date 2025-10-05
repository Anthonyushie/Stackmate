import { motion } from 'framer-motion';
import { useState } from 'react';
import { colors, shadows, animations } from '../../styles/neo-brutal-theme';

interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export default function NeoInput({
  label,
  error,
  fullWidth = false,
  ...props
}: NeoInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ width: fullWidth ? '100%' : 'auto', position: 'relative' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 900,
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            marginBottom: '8px',
            color: colors.dark,
          }}
        >
          {label}
        </label>
      )}

      <input
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: fullWidth ? '100%' : 'auto',
          padding: '12px 16px',
          fontSize: '16px',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          backgroundColor: colors.white,
          color: colors.dark,
          border: error
            ? `4px solid ${colors.error}`
            : isFocused
            ? `6px solid ${colors.accent1}`
            : `4px solid ${colors.border}`,
          boxShadow: isFocused ? shadows.brutal : shadows.brutalSmall,
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
        {...props}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: colors.error,
            color: colors.white,
            border: `3px solid ${colors.border}`,
            fontSize: '14px',
            fontWeight: 900,
            textTransform: 'uppercase',
          }}
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
