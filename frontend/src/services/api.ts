const BASE=import.meta.env.VITE_API_BASE_URL||''
export async function api<T=any>(path:string,options:RequestInit={}){const r=await fetch(`${BASE}${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||`HTTP ${r.status}`);return r.json() as Promise<T>}
