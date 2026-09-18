import type { ReactNode } from 'react';
import './globals.css';
export const metadata = {
  title: 'The Box · admin',
  description: 'Application foundation',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
