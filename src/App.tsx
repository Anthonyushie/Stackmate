import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PuzzlePage from './pages/Puzzle';
import SolvePuzzle from './pages/SolvePuzzle';
import MyWins from './pages/MyWins';
import Profile from './pages/Profile';
import LeaderboardPage from './pages/Leaderboard';
import { Toaster } from 'sonner';
import TransactionStatus from './components/TransactionStatus';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/puzzle/:id" element={<PuzzlePage />} />
          <Route path="/solve/:difficulty/:puzzleId" element={<SolvePuzzle />} />
          <Route path="/wins" element={<MyWins />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
        <TransactionStatus />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
