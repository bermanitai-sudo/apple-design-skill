import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ToastProvider } from './components/ui';
import { useSettings } from './lib/settings';
import { unlockAudio } from './lib/sound';
import { db } from './lib/db';
import './index.css';

registerSW({ immediate: true });

// Ask the browser to keep IndexedDB through storage pressure.
void navigator.storage?.persist?.();
window.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });

function Shell() {
  const s = useSettings();
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('oled', s.theme === 'oled');
    html.classList.toggle('solid', s.solid);
  }, [s.theme, s.solid]);
  return (
    <MotionConfig reducedMotion={s.reduceMotion ? 'always' : 'user'}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionConfig>
  );
}

db.open()
  .catch((e) => console.error('Storage unavailable', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </StrictMode>,
    );
  });
