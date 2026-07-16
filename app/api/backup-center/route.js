import { NextResponse } from "next/server";
const dbm=require("@/lib/db");
export const dynamic="force-dynamic"; export const runtime="nodejs";
export async function GET(){
  const worlds=dbm.listWorlds().map(w=>({id:w.world_id,name:w.display_name,backups:dbm.listBackups(w.world_id)}));
  return NextResponse.json({ok:true,preview:false,worlds});
}
