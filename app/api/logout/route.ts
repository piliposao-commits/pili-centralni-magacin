import { NextResponse } from "next/server";
export async function POST(){const r=NextResponse.json({ok:true});r.cookies.set("cm_session","",{path:"/",maxAge:0});return r;}
