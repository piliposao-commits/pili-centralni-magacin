import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
export async function POST(req:Request){
  try{
    const s=await requireSession();
    const body=await req.json();
    const {data,error}=await admin.rpc("cm_create_transfer",{p_user_id:s.id,p_destination_id:body.destination_id,p_lines:body.lines,p_request_id:body.request_id||null});
    if(error) throw error;
    return NextResponse.json({ok:true,data});
  }catch(e:any){return NextResponse.json({ok:false,message:e.message},{status:400});}
}
