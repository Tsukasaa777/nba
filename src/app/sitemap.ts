import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap{const base=process.env.NEXT_PUBLIC_SITE_URL;if(!base||!base.startsWith('https://'))return [];return ['','/games','/lab','/matchups','/methodology','/privacy'].map(p=>({url:base+p,changeFrequency:'daily',priority:p?0.7:1}));}
