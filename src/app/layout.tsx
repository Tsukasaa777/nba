import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'PropsPro IQ · Beyond the Box Score.',template:'%s · PropsPro IQ'},description:'Independent NBA player prop research. Explore game logs, matchup context, historical hit rates, and transparent statistical baselines in Philippine Time.',openGraph:{title:'PropsPro IQ',description:'Beyond the Box Score. Independent NBA research with transparent evidence.',type:'website'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a>{children}</body></html>;}
