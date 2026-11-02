'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="standalone"><h1>Something interrupted this view.</h1><p>Your saved research remains in this browser. Try loading the page again.</p><button onClick={reset}>Try again</button></main>;}
