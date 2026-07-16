import { NextResponse } from "next/server";
import pkg from "@/package.json";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ ok:true, preview:false, current:pkg.version,
    steps:[
      {id:"stop",labelKey:"update.step.stop"},{id:"backup",labelKey:"update.step.backup"},
      {id:"checksum",labelKey:"update.step.checksum"},{id:"stage",labelKey:"update.step.stage"},
      {id:"rollback",labelKey:"update.step.rollback"}
    ], noteKey:"update.stableNote" });
}
