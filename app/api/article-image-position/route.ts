import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    if (s.role !== "ADMIN") {
      return NextResponse.json({ ok: false, message: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();
    const article_id = String(body?.article_id || "");
    const image_zoom = Math.min(2.2, Math.max(0.7, Number(body?.image_zoom || 1)));
    const image_x = Math.min(100, Math.max(-100, Math.round(Number(body?.image_x || 0))));
    const image_y = Math.min(100, Math.max(-100, Math.round(Number(body?.image_y || 0))));

    if (!article_id) {
      return NextResponse.json({ ok: false, message: "Nedostaje artikal." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("cm_articles")
      .update({ image_zoom, image_x, image_y })
      .eq("id", article_id)
      .select("id,image_zoom,image_x,image_y")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, article: data });
  } catch (e: any) {
    const message = e?.message || "Greška";
    return NextResponse.json(
      { ok: false, message },
      { status: message === "UNAUTHORIZED" ? 401 : 500 }
    );
  }
}
