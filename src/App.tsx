import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PuzzlePage from './pages/Puzzle';
import SolvePuzzle from './pages/SolvePuzzle';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/puzzle/:id" element={<PuzzlePage />} />
          <Route path="/solve/:difficulty/:puzzleId" element={<SolvePuzzle />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
