import { NextRequest,NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdminRequest } from '@/lib/auth'
import { surveyRequest } from '@/lib/survey-db'

export async function GET(){
 if(!(await isAdminRequest()))return NextResponse.json({error:'Administrator access required'},{status:401})
 try{
  const [items,locations]=await Promise.all([
   surveyRequest<any[]>('WifiCoverage',{order:'name.asc'}),
   surveyRequest<any[]>('Location',{select:'id,name,category,lat,lng,status',order:'name.asc'})
  ])
  return NextResponse.json({items,locations})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load Wi-Fi inventory'},{status:500})}
}
export async function PATCH(req:NextRequest){
 if(!(await isAdminRequest()))return NextResponse.json({error:'Administrator access required'},{status:401})
 try{
  const b=await req.json();const id=String(b.id||'')
  const patch:any={updatedAt:new Date().toISOString()}
  if(b.parentLocationId!==undefined)patch.parentLocationId=b.parentLocationId||null
  if(b.wifiStatus!==undefined){if(!['available','maintenance'].includes(b.wifiStatus))return NextResponse.json({error:'Invalid Wi-Fi status'},{status:400});patch.wifiStatus=b.wifiStatus}
  const rows=await surveyRequest<any[]>('WifiCoverage',{id:`eq.${id}`},'PATCH',patch)
  if(!rows[0])return NextResponse.json({error:'Wi-Fi coverage record not found'},{status:404})
  return NextResponse.json({item:rows[0]})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not update Wi-Fi record'},{status:500})}
}
export async function POST(req:NextRequest){
 if(!(await isAdminRequest()))return NextResponse.json({error:'Administrator access required'},{status:401})
 try{
  const b=await req.json();const id=String(b.id||'')
  const rows=await surveyRequest<any[]>('WifiCoverage',{id:`eq.${id}`})
  const item=rows[0];if(!item)return NextResponse.json({error:'Wi-Fi coverage record not found'},{status:404})
  if(item.locationId)return NextResponse.json({error:'A map pin has already been created for this access point.'},{status:409})
  if(!item.parentLocationId)return NextResponse.json({error:'Select the parent campus building first.'},{status:400})
  const lat=Number(b.lat),lng=Number(b.lng),accuracy=Number(b.accuracy)
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<7.68||lat>7.75||lng<5.20||lng>5.30)return NextResponse.json({error:'GPS coordinates are outside the EKSU campus collection area.'},{status:400})
  if(!Number.isFinite(accuracy)||accuracy>40)return NextResponse.json({error:'GPS accuracy must be 40 metres or better. Wait for a stronger GPS fix.'},{status:400})
  const parent=await surveyRequest<any[]>('Location',{id:`eq.${item.parentLocationId}`})
  if(!parent[0])return NextResponse.json({error:'The selected parent building no longer exists.'},{status:400})
  const now=new Date().toISOString(),locationId=randomUUID()
  const created=await surveyRequest<any[]>('Location',{},'POST',{
   id:locationId,name:`Smart School Wi-Fi — ${item.name}`,category:'Smart School Wi-Fi',
   description:`Smart School access point. Coverage inventory: ${item.name}. GPS accuracy at capture: ${Math.round(accuracy)} m.`,
   lat,lng,geometryType:'point',coordinates:null,status:'draft',source:'admin',
   externalId:null,parentLocationId:item.parentLocationId,wifiStatus:item.wifiStatus,
   createdAt:now,updatedAt:now
  })
  await surveyRequest('WifiCoverage',{id:`eq.${id}`},'PATCH',{locationId,updatedAt:now})
  return NextResponse.json({success:true,location:created[0]},{status:201})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not create Wi-Fi map pin'},{status:500})}
}
