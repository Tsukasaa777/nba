import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'The Tsukasa Picks · Beyond the Box Score.',template:'%s · The Tsukasa Picks'},description:'Independent NBA, WNBA, and MLB research with real game results, player box scores, and transparent statistical context in Philippine Time.',openGraph:{title:'The Tsukasa Picks',description:'Beyond the Box Score. NBA, WNBA, and MLB research with transparent evidence.',type:'website'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a>{children}</body></html>;}
