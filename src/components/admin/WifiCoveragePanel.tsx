'use client'
import {useCallback,useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {Loader2,MapPin,RefreshCw,Wifi} from 'lucide-react'

type Item={id:string;name:string;wifiStatus:'available'|'maintenance';parentLocationId:string|null;locationId:string|null}
type Place={id:string;name:string;category:string;status:string}
export default function WifiCoveragePanel(){
 const [items,setItems]=useState<Item[]>([])
 const [places,setPlaces]=useState<Place[]>([])
 const [search,setSearch]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState<string|null>(null)
 const [message,setMessage]=useState('')
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/admin/wifi-coverage',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.items||[]);setPlaces(d.locations||[]);setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'Could not load Wi-Fi list')}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])
 const patch=async(id:string,data:any)=>{setBusy(id);setMessage('');try{const r=await fetch('/api/admin/wifi-coverage',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...data})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load()}catch(e){setMessage(e instanceof Error?e.message:'Update failed')}finally{setBusy(null)}}
 const capture=(item:Item)=>{
  if(!item.parentLocationId){setMessage('Choose the parent building before capturing GPS for '+item.name+'.');return}
  if(!navigator.geolocation){setMessage('This device does not support GPS location.');return}
  setBusy(item.id);setMessage('Stand beside the actual Smart School Wi-Fi access point and wait for an accurate GPS reading…')
  navigator.geolocation.getCurrentPosition(async pos=>{
   try{const r=await fetch('/api/admin/wifi-coverage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage('GPS pin created as an unverified draft. Verify it in the Locations tab after checking the pin.');await load()}
   catch(e){setMessage(e instanceof Error?e.message:'Could not save GPS pin')}
   finally{setBusy(null)}
  },err=>{setMessage(err.code===err.PERMISSION_DENIED?'Allow location access in the browser to capture this Wi-Fi point.':'GPS could not get a reliable fix. Try again outdoors or near a clear view of the sky.');setBusy(null)},{enableHighAccuracy:true,maximumAge:0,timeout:25000})
 }
 const filtered=items.filter(x=>x.name.toLowerCase().includes(search.toLowerCase()))
 const pending=items.filter(x=>!x.locationId).length
 return <div className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Smart School Wi-Fi coverage</h2><p className="text-xs text-muted-foreground">Capture each access point's real GPS position on campus.</p></div><Button size="sm" variant="outline" onClick={()=>void load()}><RefreshCw className="mr-1 h-3.5 w-3.5"/>Refresh</Button></div>
  <div className="grid grid-cols-3 gap-2"><div className="rounded-lg border bg-white p-2"><p className="text-lg font-bold">{items.length}</p><p className="text-[10px] text-muted-foreground">Coverage entries</p></div><div className="rounded-lg border bg-white p-2"><p className="text-lg font-bold text-amber-700">{pending}</p><p className="text-[10px] text-muted-foreground">Awaiting GPS</p></div><div className="rounded-lg border bg-white p-2"><p className="text-lg font-bold text-emerald-700">{items.length-pending}</p><p className="text-[10px] text-muted-foreground">Map pins created</p></div></div>
  <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Wi-Fi coverage locations…"/>
  {message&&<p className="rounded-md bg-muted p-2 text-xs" role="status">{message}</p>}
  {loading?<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin"/></div>:<div className="space-y-2">{filtered.map(item=><div key={item.id} className="rounded-lg border bg-white p-2.5">
   <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium">{item.name}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant={item.wifiStatus==='available'?'secondary':'destructive'}>{item.wifiStatus==='available'?'Available':'Under maintenance'}</Badge><Badge variant="outline">{item.locationId?'Map pin created':'GPS pending'}</Badge></div></div><Wifi className="h-4 w-4 shrink-0 text-teal-700"/></div>
   <label className="mt-2 block text-[10px] font-medium text-muted-foreground">Parent building / facility</label>
   <select className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-xs" value={item.parentLocationId||''} onChange={e=>void patch(item.id,{parentLocationId:e.target.value||null})} disabled={!!item.locationId||busy===item.id}>
    <option value="">Select parent building…</option>{places.filter(p=>p.category!=='Smart School Wi-Fi'&&p.category!=='Roads and pathways').map(p=><option key={p.id} value={p.id}>{p.name} · {p.category}</option>)}
   </select>
   <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-1 text-[10px] text-muted-foreground">Status <select className="h-7 rounded border bg-white px-1 text-xs" value={item.wifiStatus} onChange={e=>void patch(item.id,{wifiStatus:e.target.value})} disabled={busy===item.id}><option value="available">Available</option><option value="maintenance">Under maintenance</option></select></label>
    {item.locationId?<span className="text-[10px] text-emerald-700">Linked to map · verify in Locations</span>:<Button size="sm" className="h-8" disabled={busy===item.id||!item.parentLocationId} onClick={()=>capture(item)}>{busy===item.id?<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin"/>:<MapPin className="mr-1 h-3.5 w-3.5"/>}Capture GPS</Button>}
   </div>
  </div>)}</div>}
  <p className="text-[11px] leading-relaxed text-muted-foreground">GPS capture must be done while standing beside the actual access point, not at the building entrance or centre. New pins are saved as unverified; review and verify them in Locations before students see them. Faculty of Education A/B/C is represented by one combined coverage entry.</p>
 </div>
}
