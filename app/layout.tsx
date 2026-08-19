import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono, Saira_Condensed } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  variable: '--font-body',
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
});

const saira = Saira_Condensed({
  variable: '--font-display',
  weight: ['500', '600'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ARIS Command',
  description: 'Autonomous Radio-Inertial Satellite System — rail network operations console',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="day"
      className={`${plexSans.variable} ${plexMono.variable} ${saira.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
