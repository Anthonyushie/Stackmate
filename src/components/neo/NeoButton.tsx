import { motion, type HTMLMotionProps } from 'framer-motion';
import { colors, shadows, animations } from '../../styles/neo-brutal-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface NeoButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; hoverBg: string }> = {
  primary: { bg: colors.primary, text: colors.dark, hoverBg: colors.accent3 },
  secondary: { bg: colors.white, text: colors.dark, hoverBg: colors.accent1 },
  danger: { bg: colors.secondary, text: colors.white, hoverBg: colors.accent3 },
  success: { bg: colors.accent2, text: colors.dark, hoverBg: colors.primary },
  accent: { bg: colors.accent1, text: colors.dark, hoverBg: colors.accent2 },
};

const sizeStyles: Record<ButtonSize, { padding: string; fontSize: string; border: string }> = {
  sm: { padding: '8px 16px', fontSize: '14px', border: '3px' },
  md: { padding: '12px 24px', fontSize: '16px', border: '4px' },
  lg: { padding: '16px 32px', fontSize: '20px', border: '5px' },
  xl: { padding: '24px 48px', fontSize: '28px', border: '6px' },
};

export default function NeoButton({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  disabled = false,
  ...props
}: NeoButtonProps) {
  const styles = variantStyles[variant];
  const sizing = sizeStyles[size];

  return (
    <motion.button
      whileHover={disabled ? {} : animations.buttonHover}
      whileTap={disabled ? {} : animations.buttonTap}
      disabled={disabled}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        padding: sizing.padding,
        fontSize: sizing.fontSize,
        border: `${sizing.border} solid ${colors.border}`,
        boxShadow: disabled ? shadows.brutalSmall : shadows.brutal,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        display: fullWidth ? 'block' : 'inline-block',
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.5 : 1,
        transition: 'none',
      }}
      onHoverStart={(e) => {
        if (!disabled && e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.backgroundColor = styles.hoverBg;
          e.currentTarget.style.boxShadow = shadows.brutalHover;
        }
      }}
      onHoverEnd={(e) => {
        if (!disabled && e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.backgroundColor = styles.bg;
          e.currentTarget.style.boxShadow = shadows.brutal;
        }
      }}
      onTapStart={(e) => {
        if (!disabled && e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.boxShadow = shadows.brutalPressed;
        }
      }}
      onTap={(e) => {
        if (!disabled && e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.boxShadow = shadows.brutal;
        }
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
