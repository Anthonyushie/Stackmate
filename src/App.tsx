import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PuzzlePage from './pages/Puzzle';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/puzzle/:id" element={<PuzzlePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
