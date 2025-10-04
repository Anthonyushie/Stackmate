import { motion, type HTMLMotionProps } from 'framer-motion';
import { colors, shadows, animations } from '../../styles/neo-brutal-theme';

interface NeoCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  hoverable?: boolean;
  padding?: string;
  borderWidth?: string;
}

export default function NeoCard({
  children,
  color = colors.white,
  rotate = 0,
  hoverable = true,
  padding = '24px',
  borderWidth = '4px',
  ...props
}: NeoCardProps) {
  return (
    <motion.div
      initial={{ rotate }}
      whileHover={hoverable ? animations.cardHover : {}}
      style={{
        backgroundColor: color,
        border: `${borderWidth} solid ${colors.border}`,
        boxShadow: shadows.brutal,
        padding,
        position: 'relative',
        cursor: hoverable ? 'pointer' : 'default',
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
