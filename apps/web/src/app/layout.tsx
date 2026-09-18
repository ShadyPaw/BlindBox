import type { ReactNode } from 'react';
import './globals.css';
import { SiteShell } from '../components/site-shell';
export const metadata = {
  title: 'TURBOX · 神秘盲盒',
  description: '探索神秘盲盒、收藏好物與免費福利。',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
