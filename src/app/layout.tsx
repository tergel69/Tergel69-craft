import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Minecraft Clone',
  description: 'A Minecraft clone built with Next.js, React Three Fiber, and Tailwind CSS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="no-select">{children}</body>
    </html>
  );
}
