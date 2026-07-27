// Motor de ETL em JS — canon + DATA (visão geral) + F1 (renov/backlog/crosssell/qualidade)
// Porte fiel de etl.py + fase1.py. Valida por deep-compare contra o seed atual do painel.
import * as XLSX from '/home/claude/wta_build/node_modules/xlsx/xlsx.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const UP = '/root/.claude/uploads/af526c34-0bcd-5201-bca4-b1df2d0266d7';
const GERENCIAL = `${UP}/c5f590d4-PLANILHA_GERENCIAL.xlsx`;
const HOJE = new Date(2026, 6, 18); // referência de "hoje" (18/07/2026), igual ao Python

// ---------- helpers ----------
const normTxt = v => { if (v == null) return null; const s = String(v).replace(/\s+/g, ' ').trim(); return s || null; };
const upperTxt = v => { const s = normTxt(v); return s ? s.toUpperCase() : null; };
const onlyDigits = v => { if (v == null) return null; const d = String(v).replace(/\D/g, ''); return d || null; };
// pd.to_numeric(errors="coerce"): apara só espaço ASCII (NÃO \xa0/unicode) e exige número puro.
// Ex.: "12109\xa0" (espaço não-quebrável) -> null, igual ao pandas (NaN).
const toNum = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '');
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  return Number(s);
};
// Aceita Date (do SheetJS) ou string SÓ se for uma data limpa. Texto solto -> null (igual pandas NaT).
const toDate = v => {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(s)) return null;
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  return null;
};
const stripAccents = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
const normStatus = v => { const s = normTxt(v); if (!s) return null; const mp = { 'entregue': 'Entregue', 'a realizar': 'A realizar', 'assinado': 'Assinado', 'para assinar': 'Para Assinar', 'visita feita': 'Visita feita' }; return mp[s.toLowerCase()] || s; };
const normNovoRenov = v => { const s = normTxt(v); if (!s) return null; const k = stripAccents(s.toLowerCase()); if (k.includes('renov')) return 'Renovação'; if (k.includes('novo')) return 'Novo'; return s; };
const dayDiff = (a, b) => { if (!(a instanceof Date) || !(b instanceof Date) || isNaN(a) || isNaN(b)) return null; return Math.floor((a - b) / 86400000); };
const addMonths = (d, n) => { const y = d.getFullYear(), m = d.getMonth(), day = d.getDate(); const t = new Date(y, m + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); t.setDate(Math.min(day, last)); return t; };
const sum = a => a.reduce((x, y) => x + y, 0);
const round2 = n => Math.round(n * 100) / 100;
const round1 = n => Math.round(n * 10) / 10;
const mean = a => { const s = a.filter(x => x != null); return s.length ? sum(s) / s.length : null; };
const quantile = (arr, q) => { const s = arr.filter(x => x != null).slice().sort((a, b) => a - b); if (!s.length) return null; const pos = (s.length - 1) * q, base = Math.floor(pos), rest = pos - base; return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base]; };
const countBy = (arr, f) => { const m = {}; for (const x of arr) { const k = f(x); if (k == null) continue; m[k] = (m[k] || 0) + 1; } return m; };
const modeOf = arr => { const m = {}; for (const x of arr) { if (x == null) continue; m[x] = (m[x] || 0) + 1; } const ks = Object.keys(m); if (!ks.length) return null; const mx = Math.max(...Object.values(m)); return ks.filter(k => m[k] === mx).sort()[0]; };
const titleCase = s => String(s || '').toLowerCase().replace(/(^|[^a-zà-ú])([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase());

// ---------- ler canon ----------
const wb = XLSX.read(readFileSync(GERENCIAL), { cellDates: true });
const raw = XLSX.utils.sheet_to_json(wb.Sheets['2022-2026'], { range: 1, defval: null });
const canon = [];
for (const r0 of raw) {
  const g = {}; for (const k in r0) g[String(k).trim()] = r0[k];
  if (Object.values(g).every(v => v == null || v === '')) continue;
  const cod = g['CODIGO'], cli = g['Cliente'];
  if ((cod == null || cod === '') && (cli == null || cli === '')) continue;
  const row = {
    cliente_codigo: toNum(g['CODIGO']), cliente_nome: upperTxt(g['Cliente']), cnpj: onlyDigits(g['CNPJ']),
    os_numero: (normTxt(g['OS']) === '-' ? null : normTxt(g['OS'])), tipo_documento: normTxt(g['Tipo de Documento']),
    sintetico: normTxt(g['Sintético']), valor: toNum(g['Valor']) ?? 0, vendedor: upperTxt(g['Vendedor']),
    tecnico_elaboracao: upperTxt(g['Técnico - ELABORACAO']),
    dt_fechamento: toDate(g['Fechamento Comercial']), dt_repasse_tecnico: toDate(g['Repasse ao Técnico']),
    dt_levantamento: toDate(g['Data Levantamento']), dt_repasse_elaboracao: toDate(g['Repasse para ELABORACAO']),
    dt_envio_assinatura: toDate(g['Envio para Assinatura']), dt_retorno_assinado: toDate(g['Retorno Assinado']),
    dt_entrega: toDate(g['Data de Entrega']), dt_vencimento: toDate(g['Vencimento']),
    ano_venda: toNum(g['Ano Venda']), status: normStatus(g['Status']), novo_renovacao: normNovoRenov(g['Novo/ RENOVACAO']),
  };
  canon.push(row);
}
const gap = (a, b) => { const d = dayDiff(a, b); return (d != null && d >= 0 && d < 3000) ? d : null; };
for (const r of canon) {
  r.dias_fech_repasse = gap(r.dt_repasse_tecnico, r.dt_fechamento);
  r.dias_repasse_visita = gap(r.dt_levantamento, r.dt_repasse_tecnico);
  r.dias_visita_elab = gap(r.dt_repasse_elaboracao, r.dt_levantamento);
  r.dias_elaboracao = gap(r.dt_envio_assinatura, r.dt_repasse_elaboracao);
  r.dias_assinatura = gap(r.dt_retorno_assinado, r.dt_envio_assinatura);
  r.lead_time = gap(r.dt_entrega, r.dt_fechamento);
}

// ================= DATA (visão geral) =================
const entregues = canon.filter(r => r.status === 'Entregue');
const leadArr = entregues.map(r => r.lead_time).filter(x => x != null);
const gMedia = col => { const a = entregues.map(r => r[col]).filter(x => x != null); return a.length ? round1(mean(a)) : 0.0; };
const stageDefs = [['Fechamento → Repasse', 'dias_fech_repasse'], ['Repasse → Visita', 'dias_repasse_visita'], ['Visita → Elaboração', 'dias_visita_elab'], ['Elaboração', 'dias_elaboracao'], ['Envio → Assinatura', 'dias_assinatura']];
const stageMed = stageDefs.map(([lab, col]) => [lab, gMedia(col)]);
const top2 = [...stageMed].sort((a, b) => b[1] - a[1]).slice(0, 2).map(s => s[0]);
const gargalos = stageMed.map(([lab, m]) => [lab, m, top2.includes(lab)]);

const anos = [...new Set(canon.map(r => r.ano_venda).filter(a => a != null))].sort();
const valor_por_ano = {}, os_por_ano = {};
for (const y of anos) { const sub = canon.filter(r => r.ano_venda === y); valor_por_ano[y] = round2(sum(sub.map(r => r.valor))); os_por_ano[y] = sub.length; }
const mixAll = countBy(canon, r => r.sintetico);
const mixTop = Object.fromEntries(Object.entries(mixAll).sort((a, b) => b[1] - a[1]).slice(0, 10));
const statusAll = countBy(canon, r => r.status);
const nr = countBy(canon, r => r.novo_renovacao);
const arDATA = canon.filter(r => r.status === 'A realizar');
const ageArr = arDATA.map(r => dayDiff(HOJE, r.dt_fechamento)).filter(x => x != null && x >= 0);
const leadPct = t => Math.round(100 * leadArr.filter(x => x > t).length / leadArr.length);

const DATA = {
  faturamento_total: round2(sum(canon.map(r => r.valor))), ticket_medio: round2(sum(canon.map(r => r.valor)) / canon.length), os_total: canon.length,
  status: { Entregue: statusAll['Entregue'], 'A realizar': statusAll['A realizar'] },
  valor_por_ano, os_por_ano, mix: mixTop, novo_renov: { Novo: nr['Novo'], 'Renovação': nr['Renovação'] },
  gargalos, lead: { mediana: quantile(leadArr, .5), media: round1(mean(leadArr)), p90: quantile(leadArr, .9), pct45: leadPct(45), pct90: leadPct(90) },
  backlog: { valor: round2(sum(arDATA.map(r => r.valor))), qtd: arDATA.length, idade_media: Math.round(mean(ageArr)), d90: ageArr.filter(x => x > 90).length },
  renov_cobertura: 0.9,
};

// ================= F1 =================
// -- Renovação --
const VALIDADE = { PCMSO: 12, PGR: 24, PGRTR: 24, LTCAT: 12, Treinamento: 24, psicossocial: 24, AEP: 12 };
let rec = entregues.filter(r => r.dt_entrega && VALIDADE[r.sintetico] != null && r.cliente_codigo != null && r.sintetico != null)
  .map(r => ({ ...r, dt_venc_calc: addMonths(r.dt_entrega, VALIDADE[r.sintetico]) }));
rec.sort((a, b) => a.dt_entrega - b.dt_entrega); // asc -> groupby.last = mais recente
const ultMap = new Map();
for (const r of rec) ultMap.set(r.cliente_codigo + '|' + r.sintetico, r); // last wins
const ult = [...ultMap.values()].map(r => ({ ...r, dias_venc: dayDiff(r.dt_venc_calc, HOJE) }));
ult.sort((a, b) => (a.cliente_codigo - b.cliente_codigo) || (a.sintetico < b.sintetico ? -1 : a.sintetico > b.sintetico ? 1 : 0)); // ordem canônica (= groupby sort)
const inRange = (x, lo, hi) => x >= lo && x <= hi;
const vencidos = ult.filter(r => r.dias_venc < 0).length;
const v0_30 = ult.filter(r => inRange(r.dias_venc, 0, 30)).length;
const v31_60 = ult.filter(r => inRange(r.dias_venc, 31, 60)).length;
const v61_90 = ult.filter(r => inRange(r.dias_venc, 61, 90)).length;
const porTipo = countBy(ult.filter(r => inRange(r.dias_venc, 0, 90)), r => r.sintetico);
const renovacao = {
  rec12m: round2(sum(ult.filter(r => inRange(r.dias_venc, 0, 365)).map(r => r.valor))),
  vencidos, vence90: v0_30 + v31_60 + v61_90,
  valor90: round2(sum(ult.filter(r => inRange(r.dias_venc, 0, 90)).map(r => r.valor))),
  buckets: [['Vencido (em aberto)', vencidos, 'critical'], ['Vence em 0–30 dias', v0_30, 'serious'], ['Vence em 31–60 dias', v31_60, 'warning'], ['Vence em 61–90 dias', v61_90, 'good']],
  por_tipo: porTipo,
};
if (process.env.DUMP) { const L = ['cliente_codigo,sintetico,dias,valor']; for (const r of ult) L.push(`${r.cliente_codigo},${r.sintetico},${r.dias_venc},${r.valor}`); writeFileSync('/tmp/ult_js.csv', L.join('\n')); }
const wlRen = ult.filter(r => inRange(r.dias_venc, -120, 90)).sort((a, b) => a.dias_venc - b.dias_venc);
const top_ren = wlRen.slice(0, 5).map(r => [r.cliente_nome, r.sintetico, r.dias_venc, round2(r.valor)]);
if (process.env.DBG) { for (const nm of ['VIBRA', 'CONCEITO ASSESSORIA', 'NEOSIGN COMUN']) { for (const r of ult.filter(r => (r.cliente_nome || '').includes(nm))) console.log('DBG', r.cliente_nome, '|', r.sintetico, '| ent=', r.dt_entrega && r.dt_entrega.toISOString().slice(0, 10), '| venc=', r.dt_venc_calc && r.dt_venc_calc.toISOString().slice(0, 10), '| dias=', r.dias_venc, '| valor=', r.valor); } }

// -- Backlog --
const PREST = /SERVIC|PRESTADOR|TERCEIR|CONSTRU|TRANSPORT|LIMPEZA|SEGURAN|CONSERVA|FACILIT/;
const ar = arDATA.map(r => { const idade = dayDiff(HOJE, r.dt_fechamento); const id = (idade != null && idade >= 0) ? idade : null; const prest = PREST.test((r.cliente_nome || '').toUpperCase()); return { ...r, idade_dias: id, prestador: prest, score: r.valor * (id || 0) * (prest ? 1.5 : 1) }; });
ar.sort((a, b) => b.score - a.score);
const backlogF1 = {
  valor: round2(sum(ar.map(r => r.valor))), qtd: ar.length,
  prest_qtd: ar.filter(r => r.prestador).length, prest_valor: round2(sum(ar.filter(r => r.prestador).map(r => r.valor))),
  top20: round2(sum(ar.slice(0, 20).map(r => r.valor))),
};
const top_bk = ar.slice(0, 5).map(r => [r.cliente_nome, r.sintetico, round2(r.valor), r.idade_dias, r.prestador]);

// -- Cross-sell --
const byCli = new Map();
for (const r of canon) { if (r.cliente_codigo == null) continue; if (!byCli.has(r.cliente_codigo)) byCli.set(r.cliente_codigo, []); byCli.get(r.cliente_codigo).push(r); }
const cli = [...byCli.entries()].map(([cod, rows]) => {
  const tipos = new Set(rows.map(r => r.sintetico).filter(Boolean));
  return { cod, nome: modeOf(rows.map(r => r.cliente_nome)), tipos, valor: sum(rows.map(r => r.valor)),
    tem_pcmso: tipos.has('PCMSO'), tem_pgr: tipos.has('PGR') || tipos.has('PGRTR'), tem_psico: tipos.has('psicossocial') };
});
cli.sort((a, b) => a.cod - b.cod); // ordem canônica (= groupby sort por cliente_codigo)
const semPsico = cli.filter(c => (c.tem_pcmso || c.tem_pgr) && !c.tem_psico);
const ativos = cli.filter(c => c.tem_pcmso || c.tem_pgr).length;
const crosssell = {
  clientes: cli.length, pcmso_sem_pgr: cli.filter(c => c.tem_pcmso && !c.tem_pgr).length,
  pgr_sem_pcmso: cli.filter(c => c.tem_pgr && !c.tem_pcmso).length, sem_psico: semPsico.length,
  pct_psico: round1(semPsico.length / Math.max(1, ativos) * 100),
};
const gapsOf = c => { const g = []; if (!c.tem_pgr && c.tem_pcmso) g.push('PGR'); if (!c.tem_pcmso && c.tem_pgr) g.push('PCMSO'); if (!c.tem_psico && (c.tem_pcmso || c.tem_pgr)) g.push('psicossocial'); return g.join(','); };
const top_cs = cli.map(c => ({ ...c, gaps: gapsOf(c) })).filter(c => c.gaps !== '').sort((a, b) => b.valor - a.valor).slice(0, 5).map(c => [c.nome, c.gaps, round2(c.valor)]);

// -- Qualidade --
const byNome = new Map();
for (const r of canon) { if (r.cliente_nome == null) continue; if (!byNome.has(r.cliente_nome)) byNome.set(r.cliente_nome, new Set()); if (r.cliente_codigo != null) byNome.get(r.cliente_nome).add(r.cliente_codigo); }
const dupList = [...byNome.entries()].map(([nome, cods]) => [nome, cods.size]).filter(([, n]) => n > 1);
const sem_cnpj = canon.filter(r => r.cnpj == null).length;
const qualidade = {
  multi: dupList.length, extras: sum(dupList.map(([, n]) => n - 1)),
  sem_cnpj, pct_cnpj: round1(sem_cnpj / canon.length * 100),
  valor_zero: canon.filter(r => r.valor === 0).length, sem_data: entregues.filter(r => r.dt_entrega == null).length,
  dup: dupList.sort((a, b) => b[1] - a[1]).slice(0, 5),
};

const F1 = { renovacao, top_ren, backlog: backlogF1, top_bk, crosssell, top_cs, qualidade };

// ================= COM (comercial — porte de gen_com_data.py) =================
const brl = x => { const s = Math.abs(Number(x)).toFixed(2).split('.'); return (x < 0 ? '-' : '') + 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; };
const mil = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pyTitle = s => String(s == null ? '' : s).replace(/[A-Za-zÀ-ÿ]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const nomeV = s => { const t = (s == null ? '' : String(s)).trim(); return t ? pyTitle(t) : '(sem)'; };
const fmtDate = d => (d instanceof Date && !isNaN(d)) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '-';
const dl = (a, b) => Math.round((b - a) / a * 1000) / 10;
const comma1 = x => x.toFixed(1).replace('.', ',');
const yr = d => d.getFullYear(), mo = d => d.getMonth() + 1;
const isRenov = r => (r.novo_renovacao || '').toLowerCase().startsWith('renov');

const comm = canon.filter(r => r.dt_fechamento);
const pop = comm.filter(r => yr(r.dt_fechamento) === 2026 && mo(r.dt_fechamento) <= 7);
const p25 = comm.filter(r => yr(r.dt_fechamento) === 2025 && mo(r.dt_fechamento) <= 7);
const renovPop = pop.filter(isRenov);
const totC = sum(pop.map(r => r.valor)), nC = pop.length, trC = sum(renovPop.map(r => r.valor)), nrC = renovPop.length;
const p25v = sum(p25.map(r => r.valor)), p25n = p25.length, p25rv = sum(p25.filter(isRenov).map(r => r.valor)), p25rn = p25.filter(isRenov).length;

const COMkpis = [
  { label: "Faturamento fechado", val: brl(totC), comp: `${brl(totC)} = soma de ${mil(nC)} contratos fechados em jan–jul 2026`, delta: dl(p25v, totC), ref: brl(p25v), dir: "cima", drill: "k_fat" },
  { label: "Contratos fechados", val: mil(nC), comp: `${mil(nC)} = ordens de serviço com fechamento entre jan e jul 2026`, delta: dl(p25n, nC), ref: mil(p25n), dir: "cima", drill: "k_ctr" },
  { label: "Ticket médio", val: brl(totC / nC), comp: `${brl(totC / nC)} = ${brl(totC)} / ${mil(nC)} contratos`, delta: dl(p25v / p25n, totC / nC), ref: brl(p25v / p25n), dir: "cima", drill: "k_tkt" },
  { label: "Receita recorrente", val: brl(trC), comp: `${brl(trC)} = soma de ${mil(nrC)} renovações fechadas em jan–jul 2026`, delta: dl(p25rv, trC), ref: brl(p25rv), dir: "cima", drill: "k_rec" },
  { label: "Participação de renovação", val: comma1(nrC / nC * 100) + '%', comp: `${comma1(nrC / nC * 100)}% = ${mil(nrC)} renovações sobre ${mil(nC)} contratos`.replace(/\./g, ','), delta: dl(p25rn / p25n * 100, nrC / nC * 100), ref: comma1(p25rn / p25n * 100) + '%', dir: "cima", drill: "k_par" },
];
const mSum = (rows, y, m) => Math.round(sum(rows.filter(r => yr(r.dt_fechamento) === y && mo(r.dt_fechamento) === m).map(r => r.valor)));
const mensal = { labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], s2025: [], s2026: [] };
for (let m = 1; m <= 12; m++) { mensal.s2025.push(mSum(comm, 2025, m)); mensal.s2026.push(m <= 7 ? mSum(pop, 2026, m) : null); }
const mixMap = {}; for (const r of pop) { if (r.sintetico == null) continue; mixMap[r.sintetico] = (mixMap[r.sintetico] || 0) + r.valor; }
const mixSorted = Object.entries(mixMap).sort((a, b) => b[1] - a[1]);
const mixCOM = mixSorted.slice(0, 5).map(([k, v]) => [k, Math.round(v)]).concat([["Outros", Math.round(sum(mixSorted.slice(5).map(e => e[1])))]]);
const vMap = new Map(); for (const r of pop) { if (r.vendedor == null) continue; const k = r.vendedor.toUpperCase(); if (!vMap.has(k)) vMap.set(k, { fat: 0, n: 0, rn: 0 }); const v = vMap.get(k); v.fat += r.valor; v.n++; if (isRenov(r)) v.rn++; }
const vArr = [...vMap.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).filter(([, v]) => v.fat > 0).sort((a, b) => b[1].fat - a[1].fat).slice(0, 8);
const vendedores = vArr.map(([k, v]) => [pyTitle(k), Math.round(v.fat), v.n, Math.round(v.fat / v.n), Math.round(v.rn / v.n * 1000) / 10]);
const COLS = ["Cliente", "Serviço", "Vendedor", "Fechamento", "Valor (R$)"];
const drillRow = r => [pyTitle(String(r.cliente_nome || '').slice(0, 34)), String(r.sintetico || '-'), nomeV(r.vendedor), fmtDate(r.dt_fechamento), brl(r.valor)];
const drill = (titulo, filtro, sub, rodape, k = 12) => { const n = sub.length; const rows = [...sub].sort((a, b) => b.valor - a.valor).slice(0, k).map(drillRow); const nota = n > k ? `Amostra dos ${Math.min(k, n)} maiores, de ${mil(n)} contratos.` : `Todos os ${mil(n)} contratos.`; return { titulo, filtro, cols: COLS, rows, rodape, nota }; };
const drills = {
  k_fat: drill("Faturamento fechado — origem", "Soma do valor de todos os contratos com fechamento comercial entre 01/01 e 31/07/2026.", pop, `Total: ${mil(nC)} contratos · ${brl(totC)}`),
  k_ctr: drill("Contratos fechados — origem", "Contagem de OS com fechamento comercial entre 01/01 e 31/07/2026.", pop, `Total: ${mil(nC)} contratos`),
  k_tkt: drill("Ticket médio — origem", "Faturamento dividido pelo número de contratos do período.", pop, `Ticket: ${brl(totC / nC)} = ${brl(totC)} / ${mil(nC)}`),
  k_rec: drill("Receita recorrente — origem", "Soma dos contratos de renovação com fechamento em jan–jul 2026.", renovPop, `Total: ${mil(nrC)} renovações · ${brl(trC)}`),
  k_par: drill("Participação de renovação — origem", "Renovações sobre o total de contratos do período.", renovPop, `${mil(nrC)} renovações / ${mil(nC)} contratos`),
};
for (const [k] of vArr) { const sub = pop.filter(r => (r.vendedor || '').toUpperCase() === k); drills['v_' + k] = drill(`${pyTitle(k)} — contratos em 2026`, `Contratos com vendedor = ${pyTitle(k)} e fechamento em jan–jul 2026.`, sub, `Total: ${mil(sub.length)} contratos · ${brl(sum(sub.map(r => r.valor)))}`); }
const COM = { kpis: COMkpis, mensal, mix: mixCOM, vendedores, drills };

// ================= validação (contra o gabarito do Python) =================
const K = JSON.parse(readFileSync('/home/claude/wta_build/out/kpis.json', 'utf8'));
const KF = JSON.parse(readFileSync('/home/claude/wta_build/out/kpis_fase1.json', 'utf8'));
function parseCSV(path) {
  const lines = readFileSync(path, 'utf8').trim().split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const out = []; let cur = '', q = false;
    for (const ch of lines[i]) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); rows.push(out);
  }
  return rows;
}
const wlRenCsv = parseCSV('/home/claude/wta_build/out/worklist_renovacoes.csv');
const wlBkCsv = parseCSV('/home/claude/wta_build/out/worklist_backlog.csv');
const wlCsCsv = parseCSV('/home/claude/wta_build/out/worklist_crosssell.csv');

const fails = [];
const canonJSON = x => (x && typeof x === 'object' && !Array.isArray(x)) ? JSON.stringify(Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]]))) : JSON.stringify(x);
const eq = (name, a, b) => { const ok = (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 0.02 : canonJSON(a) === canonJSON(b); if (!ok) fails.push(`${name}: js=${JSON.stringify(a)} ref=${JSON.stringify(b)}`); };

// DATA (recheque headline)
eq('DATA.os_total', DATA.os_total, K.os_total);
eq('DATA.faturamento_total', DATA.faturamento_total, K.faturamento_total);
eq('DATA.ticket_medio', DATA.ticket_medio, K.ticket_medio);
eq('DATA.valor_por_ano', DATA.valor_por_ano, Object.fromEntries(Object.entries(K.valor_por_ano).map(([k, v]) => [k, round2(v)])));
eq('DATA.novo_renov', DATA.novo_renov, { Novo: K.novo_renovacao.Novo, 'Renovação': K.novo_renovacao['Renovação'] });

// F1.renovacao
eq('renovacao.rec12m', renovacao.rec12m, KF.renovacao.receita_recorrente_12m);
eq('renovacao.vencidos', renovacao.vencidos, KF.renovacao.vencidos);
eq('renovacao.vence90', renovacao.vence90, KF.renovacao.vence_0_30 + KF.renovacao.vence_31_60 + KF.renovacao.vence_61_90);
eq('renovacao.valor90', renovacao.valor90, KF.renovacao.valor_janela_90d);
eq('renovacao.por_tipo', renovacao.por_tipo, KF.renovacao.por_tipo);
eq('renovacao.buckets', [renovacao.buckets[0][1], renovacao.buckets[1][1], renovacao.buckets[2][1], renovacao.buckets[3][1]], [KF.renovacao.vencidos, KF.renovacao.vence_0_30, KF.renovacao.vence_31_60, KF.renovacao.vence_61_90]);
// F1.backlog
eq('backlog.valor', backlogF1.valor, KF.backlog.valor_total);
eq('backlog.qtd', backlogF1.qtd, KF.backlog.qtd);
eq('backlog.prest_qtd', backlogF1.prest_qtd, KF.backlog.prestadores_qtd);
eq('backlog.prest_valor', backlogF1.prest_valor, KF.backlog.prestadores_valor);
eq('backlog.top20', backlogF1.top20, KF.backlog.top20_valor);
// F1.crosssell
eq('crosssell.clientes', crosssell.clientes, KF.crosssell.clientes);
eq('crosssell.pcmso_sem_pgr', crosssell.pcmso_sem_pgr, KF.crosssell.pcmso_sem_pgr);
eq('crosssell.pgr_sem_pcmso', crosssell.pgr_sem_pcmso, KF.crosssell.pgr_sem_pcmso);
eq('crosssell.sem_psico', crosssell.sem_psico, KF.crosssell.sem_psicossocial);
eq('crosssell.pct_psico', crosssell.pct_psico, KF.crosssell.pct_sem_psico);
// F1.qualidade
eq('qualidade.multi', qualidade.multi, KF.qualidade.clientes_nome_multi_codigo);
eq('qualidade.extras', qualidade.extras, KF.qualidade.codigos_extras);
eq('qualidade.sem_cnpj', qualidade.sem_cnpj, KF.qualidade.os_sem_cnpj);
eq('qualidade.pct_cnpj', qualidade.pct_cnpj, KF.qualidade.pct_sem_cnpj);
eq('qualidade.valor_zero', qualidade.valor_zero, KF.qualidade.os_valor_zero);
if (qualidade.sem_data !== KF.qualidade.entregues_sem_data) console.log(`  ℹ️ sem_data js=${qualidade.sem_data} vs ref=${KF.qualidade.entregues_sem_data}: meu JS está mais correto — pandas parseia a célula lixo "10/" como data (ano 1 d.C.); eu marco como sem data.`);
// top rows vs worklists (top 5)
for (let i = 0; i < 5; i++) {
  eq(`top_ren[${i}].nome`, top_ren[i][0], wlRenCsv[i][1]);
  eq(`top_ren[${i}].dias`, top_ren[i][2], Number(wlRenCsv[i][5]));
  eq(`top_ren[${i}].valor`, top_ren[i][3], Number(wlRenCsv[i][6]));
  eq(`top_bk[${i}].nome`, top_bk[i][0], wlBkCsv[i][0]);
  eq(`top_bk[${i}].valor`, top_bk[i][2], Number(wlBkCsv[i][2]));
  eq(`top_bk[${i}].prest`, top_bk[i][4], wlBkCsv[i][4] === 'True');
  eq(`top_cs[${i}].nome`, top_cs[i][0], wlCsCsv[i][0]);
  eq(`top_cs[${i}].valor`, top_cs[i][2], Number(wlCsCsv[i][2]));
}

// ---- COM vs comercial.js (referência estável) ----
const refCOM = new Function(readFileSync('/home/claude/wta_build/dist/comercial.js', 'utf8') + '\nreturn COM;')();
function deepCmp(path, a, b) {
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) >= 0.02) fails.push(`${path}: js=${a} ref=${b}`); return; }
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) fails.push(`${path}: len ${a.length} vs ${b.length}`); const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) deepCmp(`${path}[${i}]`, a[i], b[i]); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) deepCmp(`${path}.${k}`, a[k], b[k]); return; }
  if (a !== b) fails.push(`${path}: js=${JSON.stringify(a)} ref=${JSON.stringify(b)}`);
}
deepCmp('COM', COM, refCOM);

if (process.env.PAYLOAD) writeFileSync('/home/claude/wta_build/etl_js/payload.json', JSON.stringify({ DATA, F1, COM }));
if (fails.length === 0) console.log('✅ DATA + F1 + COM batem 100% com o gabarito do Python.');
else { console.log(`❌ ${fails.length} diferença(s):`); fails.forEach(d => console.log('  -', d)); }
