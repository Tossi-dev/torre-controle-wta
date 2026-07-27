// Torre de Controle WTA — Resumo semanal por e-mail (F3.4)
// -------------------------------------------------------------------
// Roda 1x/semana (cron do vercel.json, segunda de manhã). Lê o snapshot
// mais recente no Supabase, monta o "Precisa de atenção" da semana e
// envia por e-mail via Resend. Espelha os alertas do painel (F3.1).
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY  (obrigatória)  chave da Resend  (re_...)
//   RESUMO_EMAIL    (obrigatória)  destinatário(s), separados por vírgula
//   RESUMO_FROM     (opcional)     remetente; padrão onboarding@resend.dev
//   CRON_SECRET     (recomendada)  trava o endpoint para só o cron da Vercel
//
// Testar/prever:
//   /api/resumo-semanal?dry=1  -> mostra o e-mail (NÃO envia, sem segredo)
//   /api/resumo-semanal        -> envia de verdade (exige o header do cron
//                                 quando CRON_SECRET está setada)

const SB = "https://dopflrttbclvtyvzlysb.supabase.co";
const KEY = "sb_publishable_pwV8JpbQjnpQY2JXh_6qyA_0DygnmuI";
const PAINEL = "https://torre-controle-wta.vercel.app";

const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n) => (Number(n) || 0).toLocaleString("pt-BR");
const dt = (s) => { try { return new Date(s).toLocaleDateString("pt-BR"); } catch (e) { return "—"; } };

async function getSnapshot() {
  const r = await fetch(SB + "/rest/v1/snapshot?select=payload,created_at,source_file&order=created_at.desc&limit=1",
    { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
  if (!r.ok) throw new Error("snapshot " + r.status);
  const rows = await r.json();
  return rows && rows[0];
}

async function getTaskResumo() {
  // Esteira de recuperação (renovações vencidas viram tarefa). Opcional — degrada em silêncio.
  try {
    const r = await fetch(SB + "/rest/v1/task?select=status", { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) return null;
    const rows = await r.json();
    const by = {};
    rows.forEach((t) => { const s = (t.status || "Aberto"); by[s] = (by[s] || 0) + 1; });
    return { total: rows.length, by };
  } catch (e) { return null; }
}

function montarAlertas(p) {
  const R = (p && p.F1 && p.F1.renovacao) || {};
  const B = (p && p.DATA && p.DATA.backlog) || {};
  const X = (p && p.F1 && p.F1.crosssell) || {};
  const A = [];
  if (R.vencidos) A.push({ sev: "crit", v: int(R.vencidos), l: "Renovações vencidas em aberto", h: "Recuperável — priorize por valor. Receita recorrente projetada 12m: " + brl(R.rec12m) + ".", tab: "renov" });
  if (R.vence90) A.push({ sev: "warn", v: int(R.vence90), l: "Vencem nos próximos 90 dias", h: "Janela para não perder a renovação — " + brl(R.valor90) + " em jogo.", tab: "renov" });
  if (B.d90) A.push({ sev: "serious", v: int(B.d90) + " OS", l: "Paradas há mais de 90 dias", h: brl(B.valor || 0) + " represados no backlog.", tab: "backlog" });
  if (X.sem_psico) A.push({ sev: "op", v: int(X.sem_psico), l: "Clientes sem psicossocial", h: "Exigência nova — venda esperando contato.", tab: "cross" });
  return A;
}

function montarHTML(p, meta, task) {
  const D = (p && p.DATA) || {};
  const A = montarAlertas(p);
  const cor = { crit: "#b91c1c", warn: "#c2410c", serious: "#a16207", op: "#1d4ed8" };
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  const cards = A.map((a) => `
    <tr><td style="padding:0 0 10px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-left:4px solid ${cor[a.sev]};border-radius:8px">
        <tr><td style="padding:14px 16px">
          <div style="font:700 22px/1.1 Arial,Helvetica,sans-serif;color:${cor[a.sev]}">${a.v}</div>
          <div style="font:600 14px/1.3 Arial,Helvetica,sans-serif;color:#111827;margin-top:2px">${a.l}</div>
          <div style="font:400 13px/1.4 Arial,Helvetica,sans-serif;color:#6b7280;margin-top:3px">${a.h}</div>
        </td></tr>
      </table>
    </td></tr>`).join("");

  let esteira = "";
  if (task && task.total) {
    const ordem = ["Aberto", "Em contato", "Renovado", "Perdido"];
    const chips = ordem.filter((s) => task.by[s]).map((s) => `${int(task.by[s])} ${s.toLowerCase()}`).join(" · ");
    esteira = `<div style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#374151;margin:8px 0 0 0">
      <b>Esteira de recuperação:</b> ${int(task.total)} renovações viraram tarefa — ${chips || "sem movimento ainda"}.</div>`;
  }

  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px 0">
  <table align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <tr><td style="background:#7a1220;padding:20px 24px">
      <div style="font:700 16px/1.2 Arial,Helvetica,sans-serif;color:#fff">Torre de Controle WTA</div>
      <div style="font:400 13px/1.3 Arial,Helvetica,sans-serif;color:#f3c9cf;margin-top:2px">Resumo da semana — ${hoje}. O que precisa de atenção.</div>
    </td></tr>
    <tr><td style="padding:20px 24px 8px 24px">
      <div style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280">
        Base: <b style="color:#111827">${int(D.os_total)}</b> OS · <b style="color:#111827">${brl(D.faturamento_total)}</b> de faturamento rastreado.
        Última atualização dos dados: ${dt(meta && meta.created_at)}.
      </div>
      ${esteira}
    </td></tr>
    <tr><td style="padding:12px 24px 4px 24px">
      <table width="100%" cellpadding="0" cellspacing="0">${cards || '<tr><td style="font:400 14px Arial;color:#374151;padding:8px 0">Tudo em dia por aqui esta semana.</td></tr>'}</table>
    </td></tr>
    <tr><td style="padding:8px 24px 24px 24px">
      <a href="${PAINEL}" style="display:inline-block;background:#7a1220;color:#fff;text-decoration:none;font:600 14px Arial;padding:11px 20px;border-radius:8px">Abrir o painel</a>
      <div style="font:400 11px/1.4 Arial,Helvetica,sans-serif;color:#9ca3af;margin-top:14px">
        Resumo automático da Torre de Controle WTA. Os números refletem a última planilha ingerida no painel.
      </div>
    </td></tr>
  </table></body></html>`;
}

async function enviar(html) {
  // Nomes de variável são case-sensitive. Aceitamos maiúsculas (convenção) e
  // minúsculas, caso a variável tenha sido criada como resend_api_key/resumo_email.
  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key;
  const to = (process.env.RESUMO_EMAIL || process.env.resumo_email || "").split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.RESUMO_FROM || process.env.resumo_from || "Torre de Controle WTA <onboarding@resend.dev>";
  if (!apiKey) throw new Error("Falta RESEND_API_KEY");
  if (!to.length) throw new Error("Falta RESUMO_EMAIL");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: "WTA · Resumo da semana — o que precisa de atenção", html })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Resend " + r.status + ": " + (j.message || JSON.stringify(j)));
  return j;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const dry = url.searchParams.get("dry") === "1";

  // Trava: quando CRON_SECRET existe, só o cron da Vercel (que manda o header) passa.
  // O modo dry (só prever, sem enviar) fica liberado — usa dados que já são públicos.
  const secret = process.env.CRON_SECRET;
  if (!dry && secret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== "Bearer " + secret) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  }

  try {
    const snap = await getSnapshot();
    const payload = snap && snap.payload;
    if (!payload || !payload.DATA) throw new Error("sem snapshot no Supabase");
    const task = await getTaskResumo();
    const html = montarHTML(payload, snap, task);

    if (dry) { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.status(200).send(html); return; }

    const sent = await enviar(html);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, service: "wta-resumo-semanal", sent_id: sent.id || null, at: new Date().toISOString() });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ ok: false, error: String((e && e.message) || e), at: new Date().toISOString() });
  }
}
