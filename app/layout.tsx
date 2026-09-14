import './globals.css'
import './portion-cleanup.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Orders NG',
  description: 'Gestione eventi, ricette e food cost Officina22',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Orders NG', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#171717',
}

const portionsCleanupScript = `
(() => {
  const setNativeValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const cleanup = () => {
    document.querySelectorAll('.recipeBasics > label').forEach((label) => {
      const text = (label.textContent || '').trim().toLowerCase();
      if (text.startsWith('porzioni standard')) {
        const input = label.querySelector('input');
        if (input && input.value !== '1') setNativeValue(input, '1');
        label.remove();
      }
    });

    document.querySelectorAll('.costRows > div').forEach((row) => {
      if ((row.textContent || '').toLowerCase().includes('costo per porzione')) row.remove();
    });

    document.querySelectorAll('.recipeCardTop p').forEach((p) => {
      p.textContent = (p.textContent || '').replace(/\s*·\s*[\d.,]+\s+porzioni?/i, '');
    });

    document.querySelectorAll('.recipeMetrics > div').forEach((row) => {
      if ((row.textContent || '').toLowerCase().includes('costo / porzione')) row.remove();
    });
  };

  cleanup();
  new MutationObserver(cleanup).observe(document.documentElement, { childList: true, subtree: true });
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: portionsCleanupScript }} />
      </body>
    </html>
  )
}
