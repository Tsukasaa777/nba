import { createClient } from '@supabase/supabase-js';
export function publicDatabase() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},db:{retry:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}}):null;
}
let browserClient:ReturnType<typeof publicDatabase>=null;
export function browserDatabase(){
 if(browserClient)return browserClient;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 browserClient=createClient(url,key);return browserClient;
}
