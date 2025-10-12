import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export interface ChessgroundBoardProps {
  fen: string;
  onMove?: (from: string, to: string) => void;
  orientation?: 'white' | 'black';
  movable?: {
    free?: boolean;
    color?: 'white' | 'black' | 'both';
    dests?: Map<Key, Key[]>;
  };
  lastMove?: [Key, Key];
  check?: 'white' | 'black' | boolean;
  highlight?: {
    lastMove?: boolean;
    check?: boolean;
  };
  turnColor?: 'white' | 'black';
}

export default function ChessgroundBoard({
  fen,
  onMove,
  orientation = 'white',
  movable,
  lastMove,
  check,
  highlight,
  turnColor,
}: ChessgroundBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!boardRef.current) return;

    const config: Config = {
      fen,
      orientation,
      movable: movable || {
        free: false,
        color: turnColor || 'white',
        dests: new Map(),
        showDests: true,
      },
      events: {
        move: (orig, dest) => {
          onMove?.(orig, dest);
        },
      },
      highlight: {
        lastMove: highlight?.lastMove ?? true,
        check: highlight?.check ?? true,
      },
    };

    if (lastMove) {
      config.lastMove = lastMove;
    }

    if (check && typeof check === 'string') {
      config.check = check;
    }

    apiRef.current = Chessground(boardRef.current, config);

    return () => {
      apiRef.current?.destroy();
    };
  }, []);

  // Update all config together to keep everything in sync
  useEffect(() => {
    if (!apiRef.current) return;

    const config: Partial<Config> = {
      fen,
      movable: {
        free: movable?.free ?? false,
        color: turnColor || movable?.color || 'white',
        dests: movable?.dests || new Map(),
        showDests: true,
      },
    };

    if (lastMove) {
      config.lastMove = lastMove;
    }

    if (check && typeof check === 'string') {
      config.check = check;
    }

    apiRef.current.set(config);
  }, [fen, movable, turnColor, lastMove, check]);

  return (
    <div
      ref={boardRef}
      style={{
        width: '100%',
        aspectRatio: '1',
        touchAction: 'none',
      }}
    />
  );
}
