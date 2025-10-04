import { motion } from 'framer-motion';
import { colors, shadows } from '../../styles/neo-brutal-theme';

interface NeoBadgeProps {
  children: React.ReactNode;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rotate?: number;
  pulse?: boolean;
}

const sizeStyles = {
  sm: { fontSize: '12px', padding: '4px 12px', border: '2px' },
  md: { fontSize: '16px', padding: '8px 16px', border: '3px' },
  lg: { fontSize: '24px', padding: '12px 24px', border: '4px' },
  xl: { fontSize: '48px', padding: '16px 32px', border: '6px' },
};

export default function NeoBadge({
  children,
  color = colors.primary,
  size = 'md',
  rotate = 0,
  pulse = false,
}: NeoBadgeProps) {
  const sizing = sizeStyles[size];

  return (
    <motion.div
      initial={{ rotate }}
      animate={pulse ? { scale: [1, 1.05, 1] } : {}}
      transition={pulse ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
      style={{
        display: 'inline-block',
        backgroundColor: color,
        color: colors.dark,
        border: `${sizing.border} solid ${colors.border}`,
        boxShadow: shadows.brutalSmall,
        padding: sizing.padding,
        fontSize: sizing.fontSize,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </motion.div>
  );
}
