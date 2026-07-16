import { NextResponse } from "next/server"; const dbm=require("@/lib/db");
export const dynamic="force-dynamic"; export const runtime="nodejs";
export async function POST(req,{params}){
  const body=await req.json().catch(()=>({})); const maxPlayers=Math.max(2,Math.min(32,Number(body.maxPlayers||32)));
  const cfg=dbm.getReservedSlots(params.id); const reservedSlots=Math.max(1,Math.min(maxPlayers-1,Number(cfg.settings.reserved_slots||1)));
  const reservedIds=new Set(cfg.players.filter(p=>p.enabled).map(p=>String(p.steam_id)));
  let players=Array.isArray(body.players)?body.players:null;
  if(!players){players=[{steamId:"76561190000000000",name:"Example Owner"}];for(let i=1;i<=32;i++)players.push({steamId:String(76561190000000000n+BigInt(i)),name:`Example Player ${i}`});}
  players=players.map(p=>({...p,steamId:String(p.steamId),reserved:reservedIds.has(String(p.steamId))}));
  const publicLimit=maxPlayers-reservedSlots; const normal=players.filter(p=>!p.reserved); const excess=Math.max(0,normal.length-publicLimit);
  const candidates=new Set(normal.slice(-excess).map(p=>p.steamId)); players=players.map(p=>({...p,wouldRemove:candidates.has(p.steamId)}));
  return NextResponse.json({ok:true,dryRun:true,noActionsExecuted:true,maxPlayers,reservedSlots,publicLimit,reservedOnline:players.filter(p=>p.reserved).length,normalOnline:normal.length,wouldRemove:players.filter(p=>p.wouldRemove),players});
}
