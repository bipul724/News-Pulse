import { Newsreader } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap' });

export const metadata = {
  title: 'News Pulse — Topic-clustered news timeline',
  description: 'News Pulse collects live news from multiple sources, groups related stories into topic clusters, and visualizes how those topics evolve over time.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body>{children}</body>
    </html>
  );
}
