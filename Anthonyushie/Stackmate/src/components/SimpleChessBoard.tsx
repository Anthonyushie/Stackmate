import { useCallback, useEffect, useState } from 'react';
import { Chess, type Square } from 'chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECE_UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

interface SimpleChessBoardProps {
  fen: string;
  onMove: (from: string, to: string) => void;
  lastMove?: { from: string; to: string } | null;
}

export default function SimpleChessBoard({ fen, onMove, lastMove }: SimpleChessBoardProps) {
  const [game, setGame] = useState(() => new Chess(fen));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  useEffect(() => {
    const g = new Chess(fen);
    setGame(g);
    setSelectedSquare(null);
  }, [fen]);

  const handleSquareClick = useCallback((square: string) => {
    if (!selectedSquare) {
      const piece = game.get(square as Square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      return;
    }

    onMove(selectedSquare, square);
    setSelectedSquare(null);
  }, [selectedSquare, game, onMove]);

  const renderSquare = (square: string, rank: string, file: string) => {
    const piece = game.get(square as Square);
    const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;
    const isSelected = selectedSquare === square;
    const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
    
    let bgColor = isLight ? '#fde68a' : '#111827';
    if (isLastMove) {
      bgColor = '#10b981';
    }
    if (isSelected) {
      bgColor = '#fbbf24';
    }

    const pieceSymbol = piece ? PIECE_UNICODE[`${piece.color}${piece.type.toUpperCase()}`] : '';
    const pieceColor = piece?.color === 'w' ? '#fff' : '#000';

    return (
      <div
        key={square}
        onClick={() => handleSquareClick(square)}
        style={{
          aspectRatio: '1',
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(32px, 8vw, 64px)',
          cursor: 'pointer',
          userSelect: 'none',
          color: pieceColor,
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          border: isSelected ? '3px solid #f59e0b' : 'none',
          position: 'relative',
        }}
      >
        {pieceSymbol}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        width: '100%',
        aspectRatio: '1',
        border: '6px solid #000',
        background: '#000',
        gap: '1px',
      }}
    >
      {RANKS.map((rank) =>
        FILES.map((file) => {
          const square = `${file}${rank}`;
          return renderSquare(square, rank, file);
        })
      )}
    </div>
  );
}
