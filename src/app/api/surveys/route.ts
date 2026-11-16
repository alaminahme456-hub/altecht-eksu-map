import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdminRequest } from '@/lib/auth'
import { surveyRequest, newVoterToken, voterHash } from '@/lib/survey-db'

const COOKIE='eksu_survey_voter'
const cookieOptions={httpOnly:true as const,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:60*60*24*365}

async function payload(survey:any, hash:string, admin:boolean){
 const [votes,comments,mine]=await Promise.all([
  surveyRequest<any[]>('SurveyVote',{surveyId:`eq.${survey.id}`}),
  surveyRequest<any[]>('SurveyComment',{surveyId:`eq.${survey.id}`,order:'createdAt.desc'}),
  surveyRequest<any[]>('SurveyVote',{surveyId:`eq.${survey.id}`,voterHash:`eq.${hash}`})
 ])
 const options=JSON.parse(survey.options) as string[]
 const counts=options.map((option,index)=>({option,count:votes.filter(v=>v.optionIndex===index).length}))
 const total=votes.length
 return {...survey,options,results:{total,counts:counts.map(x=>({...x,percentage:total?Math.round(x.count/total*100):0}))},myVote:mine[0]?.optionIndex??null,comments:comments.filter(c=>admin||c.isVisible).map(c=>({id:c.id,body:c.body,createdAt:c.createdAt,isVisible:c.isVisible}))}
}
export async function GET(req:NextRequest){
 try{
  const admin=await isAdminRequest()
  const surveys=await surveyRequest<any[]>('Survey',{order:'createdAt.desc'})
  const token=req.cookies.get(COOKIE)?.value||newVoterToken()
  const hash=voterHash(token)
  const visible=admin?surveys:surveys.filter(s=>s.status==='active')
  const data=await Promise.all(visible.map(s=>payload(s,hash,admin)))
  const response=NextResponse.json({surveys:data,admin})
  if(!req.cookies.get(COOKIE)?.value) response.cookies.set(COOKIE,token,cookieOptions)
  return response
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load surveys'},{status:500})}
}
export async function POST(req:NextRequest){
 try{
  const body=await req.json()
  const surveyId=String(body.surveyId||'')
  const surveyRows=await surveyRequest<any[]>('Survey',{id:`eq.${surveyId}`})
  const survey=surveyRows[0]
  if(!survey||survey.status!=='active') return NextResponse.json({error:'This survey is closed.'},{status:409})
  const token=req.cookies.get(COOKIE)?.value||newVoterToken()
  const hash=voterHash(token)
  if(body.action==='vote'){
   const options=JSON.parse(survey.options) as string[]
   const optionIndex=Number(body.optionIndex)
   if(!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>=options.length) return NextResponse.json({error:'Choose a valid answer.'},{status:400})
   try{await surveyRequest('SurveyVote',{},'POST',{id:randomUUID(),surveyId,voterHash:hash,optionIndex,createdAt:new Date().toISOString()})}
   catch{return NextResponse.json({error:'You have already voted in this survey.'},{status:409})}
  }else if(body.action==='comment'){
   const comment=String(body.comment||'').trim()
   if(!comment||comment.length>500) return NextResponse.json({error:'Comment must be between 1 and 500 characters.'},{status:400})
   await surveyRequest('SurveyComment',{},'POST',{id:randomUUID(),surveyId,voterHash:hash,body:comment,isVisible:true,createdAt:new Date().toISOString()})
  }else return NextResponse.json({error:'Unsupported action.'},{status:400})
  const response=NextResponse.json({success:true})
  if(!req.cookies.get(COOKIE)?.value) response.cookies.set(COOKIE,token,cookieOptions)
  return response
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not submit response'},{status:500})}
}
