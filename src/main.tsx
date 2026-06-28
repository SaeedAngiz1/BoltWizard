import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Apply persisted theme before first paint to avoid a flash.
const savedTheme = (localStorage.getItem('boltglm.theme') as 'dark' | 'light') || 'dark';
document.documentElement.dataset.theme = savedTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
