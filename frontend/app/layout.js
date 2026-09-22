import './globals.css';

export const metadata = {
  title: 'News Pulse',
  description: 'Topic-clustered news timeline',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
