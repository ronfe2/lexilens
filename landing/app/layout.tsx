import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'LexiLens – English Learning Coach',
  description:
    'LexiLens is a Chrome side-panel coach that helps you learn English directly from what you read and write.'
};

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <html lang="en">
      <body>
        <div className="ll-page-root">{children}</div>
      </body>
    </html>
  );
}

