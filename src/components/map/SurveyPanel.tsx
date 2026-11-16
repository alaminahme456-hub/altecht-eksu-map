'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, MessageSquare, Send, Vote, Plus, Eye, EyeOff, Lock, Trash2 } from 'lucide-react'

type Survey={id:string;question:string;details?:string|null;status:'active'|'closed';options:string[];myVote:number|null;results:{total:number;counts:{option:string;count:number;percentage:number}[]};comments:{id:string;body:string;createdAt:string;isVisible:boolean}[]}
export default function SurveyPanel(){
 const [surveys,setSurveys]=useState<Survey[]>([])
 const [admin,setAdmin]=useState(false)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [comment,setComment]=useState<Record<string,string>>({})
 const [question,setQuestion]=useState('')
 const [options,setOptions]=useState('Yes\nNo')
 const [details,setDetails]=useState('')
 const refresh=useCallback(async()=>{
  try{const r=await fetch('/api/surveys',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load surveys');setSurveys(d.surveys||[]);setAdmin(!!d.admin);setError('')}
  catch(e){setError(e instanceof Error?e.message:'Could not load surveys')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void refresh()},[refresh])
 const vote=async(s:Survey,index:number)=>{
  setBusy(s.id);setError('')
  try{const r=await fetch('/api/surveys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'vote',surveyId:s.id,optionIndex:index})});const d=await r.json();if(!r.ok)throw new Error(d.error);await refresh()}
  catch(e){setError(e instanceof Error?e.message:'Vote failed')}
  finally{setBusy(null)}
 }
 const sendComment=async(s:Survey)=>{
  const body=(comment[s.id]||'').trim();if(!body)return
  setBusy(s.id);setError('')
  try{const r=await fetch('/api/surveys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'comment',surveyId:s.id,comment:body})});const d=await r.json();if(!r.ok)throw new Error(d.error);setComment(p=>({...p,[s.id]:''}));await refresh()}
  catch(e){setError(e instanceof Error?e.message:'Comment failed')}
  finally{setBusy(null)}
 }
 const adminAction=async(body:any,method:'POST'|'PATCH'|'DELETE'='POST')=>{
  setBusy(body.id||body.commentId||'admin');setError('')
  try{const url=method==='DELETE'?'/api/surveys/admin?id='+encodeURIComponent(body.id):'/api/surveys/admin';const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(method==='DELETE'?{}:{body:JSON.stringify(body)})});const d=await r.json();if(!r.ok)throw new Error(d.error);await refresh()}
  catch(e){setError(e instanceof Error?e.message:'Admin action failed')}
  finally{setBusy(null)}
 }
 const create=async()=>{
  const opts=options.split('\n').map(x=>x.trim()).filter(Boolean)
  await adminAction({question,options:opts,details})
  setQuestion('');setOptions('Yes\nNo');setDetails('')
 }
 return <section className="mt-3 border-t pt-3">
  <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Vote className="h-4 w-4"/> Surveys &amp; Comments</h3><Badge variant="outline">{surveys.length} survey{surveys.length===1?'':'s'}</Badge></div>
  <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">Vote on campus improvements and share suggestions. One vote per browser for each survey.</p>
  {error&&<p role="alert" className="mb-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>}
  {admin&&<div className="mb-3 space-y-2 rounded-lg border bg-stone-50 p-2.5">
   <p className="text-xs font-semibold">Administrator · Create survey</p>
   <Input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Survey question"/>
   <Textarea value={options} onChange={e=>setOptions(e.target.value)} rows={3} placeholder="One answer option per line"/>
   <Input value={details} onChange={e=>setDetails(e.target.value)} placeholder="Optional note or context"/>
   <Button size="sm" className="w-full" disabled={!question.trim()||busy!==null} onClick={()=>void create()}><Plus className="mr-1 h-3.5 w-3.5"/> Publish survey</Button>
  </div>}
  {loading?<div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin"/></div>:surveys.length===0?<p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">No active surveys right now.</p>:surveys.map(s=><article key={s.id} className="mb-3 rounded-lg border p-2.5">
   <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold leading-snug">{s.question}</p><Badge variant={s.status==='active'?'default':'secondary'}>{s.status}</Badge></div>
   {s.details&&<p className="mt-1 text-[11px] text-muted-foreground">{s.details}</p>}
   <div className="mt-2 space-y-1.5">{s.options.map((option,i)=>{
    const result=s.results.counts[i];const chosen=s.myVote===i
    return <div key={i}>
     <Button size="sm" variant={chosen?'default':'outline'} className="h-8 w-full justify-between text-xs" disabled={s.status!=='active'||s.myVote!==null||busy===s.id} onClick={()=>void vote(s,i)}>
      <span>{option}{chosen?' · Your vote':''}</span><span>{s.results.total>0?result?.percentage+'%':''}</span>
     </Button>
     {s.results.total>0&&<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:(result?.percentage||0)+'%'}}/></div>}
     {s.results.total>0&&<p className="text-right text-[10px] text-muted-foreground">{result?.count||0} vote{result?.count===1?'':'s'}</p>}
    </div>
   })}</div>
   <p className="mt-2 text-[10px] text-muted-foreground">{s.results.total} total vote{s.results.total===1?'':'s'}{s.myVote!==null?' · You have voted':''}</p>
   <div className="mt-3 border-t pt-2"><p className="mb-2 flex items-center gap-1 text-xs font-semibold"><MessageSquare className="h-3.5 w-3.5"/> Suggestions &amp; comments ({s.comments.length})</p>
    <div className="mb-2 flex gap-1"><Input value={comment[s.id]||''} maxLength={500} onChange={e=>setComment(p=>({...p,[s.id]:e.target.value}))} placeholder="Leave a comment…" className="h-8 text-xs"/><Button size="icon" className="h-8 w-8 shrink-0" disabled={!comment[s.id]?.trim()||busy===s.id} onClick={()=>void sendComment(s)} aria-label="Send comment"><Send className="h-3.5 w-3.5"/></Button></div>
    {s.comments.map(c=><div key={c.id} className="mb-1 flex items-start gap-2 rounded bg-muted/60 p-2"><p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs">{c.body}</p>{admin&&<Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={()=>void adminAction({commentId:c.id,isVisible:!c.isVisible},'PATCH')} aria-label={c.isVisible?'Hide comment':'Show comment'}>{c.isVisible?<EyeOff className="h-3 w-3"/>:<Eye className="h-3 w-3"/>}</Button>}</div>)}
   </div>
   {admin&&<div className="mt-2 flex flex-wrap gap-1 border-t pt-2"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={()=>void adminAction({id:s.id,status:s.status==='active'?'closed':'active'},'PATCH')}><Lock className="mr-1 h-3 w-3"/>{s.status==='active'?'Close':'Reopen'}</Button><Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={()=>{if(window.confirm('Permanently delete this survey and its votes/comments?'))void adminAction({id:s.id},'DELETE')}}><Trash2 className="mr-1 h-3 w-3"/>Delete</Button></div>}
  </article>)}
  <p className="text-[10px] text-muted-foreground">Votes are limited by a browser cookie, not a verified student account. Avoid posting private or personal information.</p>
 </section>
}
