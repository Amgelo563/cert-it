import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import './index.css';
import App from './App.tsx';
import { AdminI18n } from './app/i18n/AdminI18n';

const i18n = AdminI18n.create();
await i18n.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n.getInstance()}>
      <App />
    </I18nextProvider>
  </StrictMode>,
);
