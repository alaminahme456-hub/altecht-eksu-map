import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdminRequest } from '@/lib/auth'
import { surveyRequest } from '@/lib/survey-db'

export async function POST(req:NextRequest){
 if(!(await isAdminRequest())) return NextResponse.json({error:'Administrator access required'},{status:401})
 try{
  const body=await req.json()
  const question=String(body.question||'').trim()
  const options=Array.isArray(body.options)?body.options.map((x:any)=>String(x).trim()).filter(Boolean):[]
  if(question.length<8||question.length>300||options.length<2||options.length>6||options.some(x=>x.length>80)) return NextResponse.json({error:'Enter a question and 2–6 valid options.'},{status:400})
  const now=new Date().toISOString()
  const rows=await surveyRequest<any[]>('Survey',{},'POST',{id:randomUUID(),question,options:JSON.stringify(options),details:String(body.details||'').slice(0,500),status:'active',createdAt:now,updatedAt:now})
  return NextResponse.json({survey:rows[0]},{status:201})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not create survey'},{status:500})}
}
export async function PATCH(req:NextRequest){
 if(!(await isAdminRequest())) return NextResponse.json({error:'Administrator access required'},{status:401})
 try{
  const body=await req.json()
  if(body.commentId){
   const rows=await surveyRequest<any[]>('SurveyComment',{id:`eq.${String(body.commentId)}`},'PATCH',{isVisible:Boolean(body.isVisible)})
   return NextResponse.json({success:!!rows[0]})
  }
  const id=String(body.id||'')
  if(!id||!['active','closed'].includes(body.status)) return NextResponse.json({error:'Invalid survey update.'},{status:400})
  const rows=await surveyRequest<any[]>('Survey',{id:`eq.${id}`},'PATCH',{status:body.status,updatedAt:new Date().toISOString()})
  return NextResponse.json({success:!!rows[0]})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not update survey'},{status:500})}
}
export async function DELETE(req:NextRequest){
 if(!(await isAdminRequest())) return NextResponse.json({error:'Administrator access required'},{status:401})
 try{
  const id=new URL(req.url).searchParams.get('id')
  if(!id) return NextResponse.json({error:'Survey id required.'},{status:400})
  await surveyRequest('Survey',{id:`eq.${id}`},'DELETE')
  return NextResponse.json({success:true})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not delete survey'},{status:500})}
}
