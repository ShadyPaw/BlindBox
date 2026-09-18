import type { CSSProperties } from 'react';

const paths: Record<string, string> = {
  home: 'M3 10 12 3l9 7-2 10H5L3 10Zm7 2v4h4v-4h-4Z',
  box: 'm12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5M12 12v10M7 4.8l9 5',
  gift: 'M3 9h18v5H3V9Zm2 5v7h14v-7M12 9v12M12 9C2 9 6 0 10 5l2 4Zm0 0c10 0 6-9 2-4l-2 4Z',
  chart: 'M4 21V11h3v10M11 21V3h3v18M18 21V7h3v14',
  diamond: 'm3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5Z',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'm9 5 7 7-7 7',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4M12 14v3',
  chat: 'M4 3h16v15H9l-5 4V3Zm3 5h2m6 0h2M8 12c2 3 6 3 8 0',
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2',
  menu: 'M3 6h18M3 12h18M3 18h18',
  bolt: 'm13 2-9 12h7l-1 8L21 9h-8l1-7Z',
  flame:
    'M13 2c2 6-5 7-2 11 1-2 4-3 4-6 9 9 3 15-3 15S1 16 7 8c0 4 1 5 2 5-2-5 3-6 4-11Z',
  share:
    'M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM9 10l6-5M9 14l6 5',
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.box} />
    </svg>
  );
}
