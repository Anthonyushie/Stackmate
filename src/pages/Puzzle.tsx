import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, ArrowLeft, Coins } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import ChessPuzzleSolver from '../components/ChessPuzzleSolver';
import { getPuzzlesByDifficulty, type Puzzle } from '../lib/puzzles-db';
import { useQuery } from '@tanstack/react-query';
import { getPuzzleInfo, type PuzzleInfo } from '../lib/contracts';
import Header from '../components/Header';
import { colors, shadows, getDifficultyColor } from '../styles/neo-brutal-theme';
import NeoButton from '../components/neo/NeoButton';
import NeoBadge from '../components/neo/NeoBadge';
import { microToStx } from '../lib/stacks';

export default function PuzzlePage() {
  const params = useParams();
  const navigate = useNavigate();
  const puzzleIdParam = params.id || '1';
  const numericId = Number(puzzleIdParam);
  const { network } = useWallet();

  const { data: info, isLoading, error } = useQuery<PuzzleInfo>({
    queryKey: ['puzzle-info', network, puzzleIdParam],
    queryFn: () => getPuzzleInfo({ puzzleId: numericId, network }),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  const chosen = useMemo(() => {
    if (!info) return null as Puzzle | null;
    const d = (info.difficulty || '').toLowerCase();
    const list = getPuzzlesByDifficulty((d as any) || 'beginner');
    if (!list.length) return null;
    const idx = Math.abs((numericId || 1) - 1) % list.length;
    return list[idx];
  }, [info, numericId]);

  const difficultyColor = getDifficultyColor(info?.difficulty?.toLowerCase() as any);

  return (
    <div style={{ minHeight: '100vh', background: colors.light, position: 'relative', overflow: 'hidden' }}>
      {/* Grain texture */}
      <div className="grain-texture" style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }} />
      
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1400px', margin: '0 auto', padding: '32px 20px' }}>
        <Header />

        {/* Back button */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          style={{ marginBottom: '24px' }}
        >
          <NeoButton variant="secondary" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 inline mr-2" />
            BACK TO HOME
          </NeoButton>
        </motion.div>

        {/* Puzzle Info Card */}
        <motion.div
          initial={{ rotate: -1, y: 20, opacity: 0 }}
          animate={{ rotate: -1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          style={{
            padding: '24px',
            background: difficultyColor,
            border: `6px solid ${colors.border}`,
            boxShadow: shadows.brutal,
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            {/* Left: Puzzle ID and Title */}
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '8px' }}>
                PUZZLE
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 'clamp(32px, 5vw, 48px)', textTransform: 'uppercase', letterSpacing: '-0.02em', color: colors.dark }}>
                #{puzzleIdParam}
              </div>
            </div>

            {/* Right: Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', minWidth: '300px' }}>
              <div
                style={{
                  padding: '12px',
                  background: colors.dark,
                  border: `4px solid ${colors.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Trophy className="h-4 w-4" style={{ color: colors.primary }} />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', color: colors.white }}>
                    PRIZE POOL
                  </span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(16px, 3vw, 20px)', color: colors.primary, textShadow: `0 0 6px ${colors.primary}` }}>
                  {info ? microToStx(info.prizePool) : '—'} STX
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: colors.accent,
                  border: `4px solid ${colors.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Users className="h-4 w-4" style={{ color: colors.dark }} />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', color: colors.dark }}>
                    PLAYERS
                  </span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(16px, 3vw, 20px)', color: colors.dark }}>
                  {info ? String(info.entryCount) : '—'}
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: colors.success,
                  border: `4px solid ${colors.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Coins className="h-4 w-4" style={{ color: colors.dark }} />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', color: colors.dark }}>
                    ENTRY FEE
                  </span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 'clamp(16px, 3vw, 20px)', color: colors.dark }}>
                  {info ? microToStx(info.stakeAmount) : '—'} STX
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: colors.white,
                  border: `4px solid ${colors.border}`,
                }}
              >
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  DIFFICULTY
                </div>
                <NeoBadge color={difficultyColor} size="md">
                  {info?.difficulty?.toUpperCase() ?? '—'}
                </NeoBadge>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chess Puzzle Solver */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
        >
          {isLoading && (
            <div
              style={{
                padding: '80px 20px',
                background: colors.white,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '20px',
                  textTransform: 'uppercase',
                  color: colors.dark,
                }}
              >
                LOADING PUZZLE...
              </div>
            </div>
          )}
          
          {error && (
            <div
              style={{
                padding: '40px',
                background: colors.error,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '28px',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  color: colors.white,
                }}
              >
                FAILED TO LOAD
              </h2>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '14px', marginBottom: '20px', color: colors.white }}>
                Unable to load puzzle information
              </p>
              <NeoButton variant="primary" size="lg" onClick={() => navigate('/')}>
                GO HOME
              </NeoButton>
            </div>
          )}
          
          {chosen && !isLoading && !error && (
            <ChessPuzzleSolver 
              puzzleId={String(puzzleIdParam)} 
              fen={chosen.fen} 
              solution={chosen.solution} 
            />
          )}
          
          {!isLoading && !chosen && !error && (
            <div
              style={{
                padding: '40px',
                background: colors.white,
                border: `6px solid ${colors.border}`,
                boxShadow: shadows.brutal,
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: '28px',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  color: colors.dark,
                }}
              >
                PUZZLE NOT FOUND
              </h2>
              <NeoButton variant="primary" size="lg" onClick={() => navigate('/')}>
                GO HOME
              </NeoButton>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
