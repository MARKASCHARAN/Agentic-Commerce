import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BladeProvider } from '@razorpay/blade/components';
import { bladeTheme } from '@razorpay/blade/tokens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BladeProvider themeTokens={bladeTheme} colorScheme="light">
        <App />
      </BladeProvider>
    </QueryClientProvider>
  </StrictMode>
);
