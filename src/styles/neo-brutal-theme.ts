export const colors = {
  primary: '#FFE500',
  secondary: '#FF006E',
  accent1: '#00F5FF',
  accent2: '#39FF14',
  accent3: '#FF6B35',
  accent: '#00F5FF',
  background: '#F5F5F0',
  light: '#F5F5F0',
  dark: '#000000',
  white: '#FFFFFF',
  border: '#000000',
  
  // Difficulty colors
  beginner: '#39FF14',
  intermediate: '#00F5FF',
  expert: '#FF006E',
  
  // State colors
  success: '#39FF14',
  error: '#FF006E',
  warning: '#FFE500',
} as const;

export const shadows = {
  brutal: '8px 8px 0px #000000',
  brutalHover: '12px 12px 0px #000000',
  brutalPressed: '2px 2px 0px #000000',
  brutalLarge: '16px 16px 0px #000000',
  brutalSmall: '4px 4px 0px #000000',
  none: 'none',
} as const;

export const borders = {
  thin: '3px solid #000000',
  medium: '4px solid #000000',
  thick: '6px solid #000000',
  extraThick: '8px solid #000000',
} as const;

export const typography = {
  heading: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 900,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  mono: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
  },
} as const;

export const animations = {
  // Button hover
  buttonHover: {
    scale: 1,
    x: -2,
    y: -2,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  buttonPress: {
    scale: 0.98,
    x: 4,
    y: 4,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  buttonTap: {
    scale: 0.95,
  },

  // Card hover
  cardHover: {
    y: -8,
    rotate: 0,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  cardInitial: {
    y: 0,
  },

  // Success animation
  success: {
    scale: [1, 1.1, 0.95, 1.05, 1],
    rotate: [0, -5, 5, -3, 0],
    transition: { duration: 0.5, type: 'spring', stiffness: 300 },
  },

  // Error shake
  errorShake: {
    x: [-10, 10, -10, 10, -5, 5, 0],
    transition: { duration: 0.5, type: 'spring', stiffness: 500 },
  },

  // Slide in from top
  slideInTop: {
    initial: { y: -100, opacity: 0, rotate: -2 },
    animate: { y: 0, opacity: 1, rotate: 0 },
    exit: { y: -100, opacity: 0, rotate: 2 },
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },

  // Fade in
  fadeIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2 },
  },

  // Pop in
  popIn: {
    initial: { scale: 0, rotate: -10 },
    animate: { scale: 1, rotate: 0 },
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },

  // Pulse
  pulse: {
    scale: [1, 1.05, 1],
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
  },

  // Rotate
  rotate: {
    rotate: [0, 360],
    transition: { repeat: Infinity, duration: 2, ease: 'linear' },
  },
} as const;

export const gradients = {
  rainbow: 'linear-gradient(135deg, #FFE500 0%, #FF006E 25%, #00F5FF 50%, #39FF14 75%, #FF6B35 100%)',
  chaos: 'linear-gradient(45deg, #FFE500 0%, #00F5FF 33%, #FF006E 66%, #39FF14 100%)',
  beginner: 'linear-gradient(135deg, #39FF14 0%, #FFE500 100%)',
  intermediate: 'linear-gradient(135deg, #00F5FF 0%, #FFE500 100%)',
  expert: 'linear-gradient(135deg, #FF006E 0%, #FF6B35 100%)',
} as const;

export const textures = {
  noise: `
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
  `,
  grain: `
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='5' numOctaves='1' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E");
  `,
  stripes: `
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.1) 10px,
      rgba(0, 0, 0, 0.1) 20px
    );
  `,
} as const;

export const zIndex = {
  background: 0,
  content: 10,
  card: 20,
  header: 50,
  modal: 100,
  notification: 200,
} as const;

export function getRotation(index: number): number {
  const rotations = [-2, 1, -1, 2, -3, 3, -1, 2];
  return rotations[index % rotations.length];
}

export function normalizeDifficulty(difficulty: string): 'beginner' | 'intermediate' | 'expert' {
  const raw = (difficulty || '').toString().toLowerCase().trim();
  const unquoted = raw.replace(/^['"]+|['"]+$/g, '');
  if (unquoted === 'intermediate') return 'intermediate';
  if (unquoted === 'expert') return 'expert';
  return 'beginner';
}

export function getDifficultyColor(difficulty: string): string {
  const d = normalizeDifficulty(difficulty);
  if (d === 'intermediate') return colors.intermediate;
  if (d === 'expert') return colors.expert;
  return colors.beginner;
}

export function getDifficultyGradient(difficulty: string): string {
  const d = normalizeDifficulty(difficulty);
  if (d === 'intermediate') return gradients.intermediate;
  if (d === 'expert') return gradients.expert;
  return gradients.beginner;
}
