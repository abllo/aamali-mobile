import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, MemoryRouter } from 'react-router';
import { DEMO } from './lib/data';
import { Toaster } from 'sonner';
import App from './App';
import { registerServiceWorker } from './lib/push';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* المعاينة: تنقّل داخلي بدون الرابط. التطبيق: HashRouter يشتغل على GitHub Pages */}
      {DEMO ? <MemoryRouter><App /></MemoryRouter> : <HashRouter><App /></HashRouter>}
      <Toaster dir="rtl" position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
);
