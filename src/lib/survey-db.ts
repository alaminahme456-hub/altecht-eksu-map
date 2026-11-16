import { createHash, randomUUID } from 'crypto'

const base = () => {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase server API is not configured.')
  return { url: url.replace(/\/$/, ''), key }
}
export async function surveyRequest<T=any>(table:string, query:Record<string,string>={}, method='GET', body?:unknown):Promise<T>{
  const {url,key}=base()
  const params=new URLSearchParams({select:'*',...query})
  const res=await fetch(`${url}/rest/v1/${table}?${params.toString()}`,{
    method,cache:'no-store',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(method==='GET'?{}:{Prefer:'return=representation'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  })
  const raw=await res.text()
  let data:any=null
  try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok) throw new Error(typeof data==='object'?(data?.message||JSON.stringify(data)):String(data||res.statusText))
  return data as T
}
export function newVoterToken(){return randomUUID()+randomUUID()}
export function voterHash(token:string){return createHash('sha256').update((process.env.SESSION_SECRET||process.env.ADMIN_PASSWORD||'eksu-survey-voter')+':'+token).digest('hex')}
