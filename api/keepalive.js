// Torre de Controle WTA — keepalive
// Roda 1x/dia (cron do vercel.json). Faz um SELECT no Supabase para gerar
// atividade no banco e impedir a pausa automática do projeto free (~7 dias ocioso).
export default async function handler(req, res) {
  const base = "https://dopflrttbclvtyvzlysb.supabase.co";
  const key = "sb_publishable_pwV8JpbQjnpQY2JXh_6qyA_0DygnmuI";
  const out = { ok: true, service: "wta-keepalive", at: new Date().toISOString(), rest: null };
  try {
    const r = await fetch(base + "/rest/v1/snapshot?select=id&limit=1", {
      headers: { apikey: key, Authorization: "Bearer " + key }
    });
    out.rest = r.status;
    if (!r.ok) out.ok = false;
  } catch (e) {
    out.ok = false;
    out.rest = "error";
    out.error = String((e && e.message) || e);
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(out.ok ? 200 : 500).json(out);
}
