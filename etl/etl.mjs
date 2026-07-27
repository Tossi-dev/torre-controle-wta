// Torre de Controle WTA — Motor de ETL (Node ESM)
// -----------------------------------------------------------------------------
// Lê a PLANILHA_GERENCIAL.xlsx (aba "2022-2026") e gera o payload do painel:
//   { DATA, F1, COM }
//   - DATA : visão geral (faturamento, OS, mix, gargalos, backlog, lead time)
//   - F1   : renovações, dinheiro parado (backlog), cross-sell, qualidade de dados
//   - COM  : diagnóstico comercial (KPIs jan–jul 2026 vs 2025, mensal, mix, vendedores, drills)
//
// Este é o porte fiel do motor em Python (etl.py + fase1.py + gen_com_data.py),
// validado 100% contra o gabarito. A versão com o harness de validação está em
// `etl_full.validated.mjs` (guardada para prova de corretude; depende dos
// arquivos de referência do Python e não roda fora daquele ambiente).
//
// USO:
//   npm install
//   node etl/etl.mjs [caminho/para/PLANILHA_GERENCIAL.xlsx] [saida.json]
// Padrões: entrada = ./data/PLANILHA_GERENCIAL.xlsx, saída = ./etl/payload.json
//
// "Hoje" (referência para vencimentos/idade do backlog) usa a data atual do
// sistema. Para reproduzir os números validados de 18/07/2026, defina:
//   WTA_HOJE=2026-07-18 node etl/etl.mjs ...
// -----------------------------------------------------------------------------
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const GERENCIAL = process.argv[2] || './data/PLANILHA_GERENCIAL.xlsx';
const OUT       = process.argv[3] || './etl/payload.json';
const HOJE      = process.env.WTA_HOJE
  ? (() => { const [y, m, d] = process.env.WTA_HOJE.split('-').map(Number); return new Date(y, m - 1, d); })()
  : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
const DRILL_K   = process.env.WTA_DRILL_K ? parseInt(process.env.WTA_DRILL_K, 10) : 12; // linhas por drill (seed usa 5)

// ---------- helpers ----------
const normTxt = v => { if (v == null) return null; const s = String(v).replace(/\s+/g, ' ').trim(); return s || null; };
const upperTxt = v => { const s = normTxt(v); return s ? s.toUpperCase() : null; };
const onlyDigits = v => { if (v == null) return null; const d = String(v).replace(/\D/g, ''); return d || null; };
// pd.to_numeric(errors="coerce"): apara só espaço ASCII (NÃO \xa0/unicode) e exige número puro.
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

// ---------- ler canon ----------
const wb = XLSX.read(readFileSync(GERENCIAL), { cellDates: true });
const sheet = wb.Sheets['2022-2026'];
if (!sheet) { console.error('❌ Aba "2022-2026" não encontrada em ' + GERENCIAL + '. Abas: ' + wb.SheetNames.join(', ')); process.exit(1); }
const raw = XLSX.utils.sheet_to_json(sheet, { range: 1, defval: null });
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
const wlRen = ult.filter(r => inRange(r.dias_venc, -120, 90)).sort((a, b) => a.dias_venc - b.dias_venc);
const top_ren = wlRen.slice(0, 5).map(r => [r.cliente_nome, r.sintetico, r.dias_venc, round2(r.valor)]);

// -- Backlog (dinheiro parado) --
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

// -- Qualidade de dados --
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

// ================= COM (comercial) =================
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
const drill = (titulo, filtro, sub, rodape, k = DRILL_K) => { const n = sub.length; const rows = [...sub].sort((a, b) => b.valor - a.valor).slice(0, k).map(drillRow); const nota = n > k ? `Amostra dos ${Math.min(k, n)} maiores, de ${mil(n)} contratos.` : `Todos os ${mil(n)} contratos.`; return { titulo, filtro, cols: COLS, rows, rodape, nota }; };
const drills = {
  k_fat: drill("Faturamento fechado — origem", "Soma do valor de todos os contratos com fechamento comercial entre 01/01 e 31/07/2026.", pop, `Total: ${mil(nC)} contratos · ${brl(totC)}`),
  k_ctr: drill("Contratos fechados — origem", "Contagem de OS com fechamento comercial entre 01/01 e 31/07/2026.", pop, `Total: ${mil(nC)} contratos`),
  k_tkt: drill("Ticket médio — origem", "Faturamento dividido pelo número de contratos do período.", pop, `Ticket: ${brl(totC / nC)} = ${brl(totC)} / ${mil(nC)}`),
  k_rec: drill("Receita recorrente — origem", "Soma dos contratos de renovação com fechamento em jan–jul 2026.", renovPop, `Total: ${mil(nrC)} renovações · ${brl(trC)}`),
  k_par: drill("Participação de renovação — origem", "Renovações sobre o total de contratos do período.", renovPop, `${mil(nrC)} renovações / ${mil(nC)} contratos`),
};
for (const [k] of vArr) { const sub = pop.filter(r => (r.vendedor || '').toUpperCase() === k); drills['v_' + k] = drill(`${pyTitle(k)} — contratos em 2026`, `Contratos com vendedor = ${pyTitle(k)} e fechamento em jan–jul 2026.`, sub, `Total: ${mil(sub.length)} contratos · ${brl(sum(sub.map(r => r.valor)))}`); }
const COM = { kpis: COMkpis, mensal, mix: mixCOM, vendedores, drills };

// ================= drills de TODOS os KPIs (Visão geral + Renovações + Backlog + Cross-sell + Qualidade) =================
const mkDrill = (titulo, filtro, cols, sub, rowFn, rodape) => {
  const n = sub.length;
  const rows = sub.slice(0, DRILL_K).map(rowFn);
  const nota = n > DRILL_K ? `Amostra dos ${Math.min(DRILL_K, n)} maiores, de ${mil(n)} registros.` : `Todos os ${mil(n)} registros.`;
  return { titulo, filtro, cols, rows, rodape, nota };
};
const cNome = r => pyTitle(String(r.cliente_nome || '').slice(0, 34));
const byValDesc = (a, b) => b.valor - a.valor;
const COLS_OSF = ["Cliente", "Serviço", "Fechamento", "Valor (R$)"];
const rowOSF = r => [cNome(r), String(r.sintetico || '-'), fmtDate(r.dt_fechamento), brl(r.valor)];
const COLS_REN = ["Cliente", "Serviço", "Situação", "Valor (R$)"];
const rowREN = r => [cNome(r), String(r.sintetico || '-'), (r.dias_venc < 0 ? `vencido há ${-r.dias_venc}d` : `vence em ${r.dias_venc}d`), brl(r.valor)];
const COLS_BK = ["Cliente", "Serviço", "Idade (dias)", "Valor (R$)"];
const rowBK = r => [cNome(r), String(r.sintetico || '-'), (r.idade_dias != null ? mil(r.idade_dias) : '-'), brl(r.valor)];
const COLS_CS = ["Cliente", "Gaps", "Valor (R$)"];
const rowCS = c => [pyTitle(String(c.nome || '').slice(0, 34)), gapsOf(c) || '-', brl(c.valor)];

const allByVal = [...canon].sort(byValDesc);
const entByVal = [...entregues].sort(byValDesc);
const ren0_365 = ult.filter(r => inRange(r.dias_venc, 0, 365)).sort(byValDesc);
const renVenc = ult.filter(r => r.dias_venc < 0).sort(byValDesc);
const ren0_90 = ult.filter(r => inRange(r.dias_venc, 0, 90)).sort(byValDesc);
// fila completa de renovações vencidas (para tarefas + export) — chave estável por cliente+serviço
const filaRenov = renVenc.slice(0, 300).map(r => ({ k: r.cliente_codigo + '|' + r.sintetico, cli: pyTitle(String(r.cliente_nome || '').slice(0, 40)), srv: String(r.sintetico || '-'), dias: r.dias_venc, val: round2(r.valor) }));

DATA.drills = {
  h_fat: mkDrill("Faturamento rastreado — origem", "Soma do valor de todas as OS da base (2022–2026).", COLS_OSF, allByVal, rowOSF, `Total: ${mil(DATA.os_total)} OS · ${brl(DATA.faturamento_total)}`),
  h_os: mkDrill("Ordens de serviço — origem", "Todas as ordens de serviço registradas na base (2022–2026).", COLS_OSF, allByVal, rowOSF, `Total: ${mil(DATA.os_total)} OS`),
  h_ent: mkDrill("Entregues — origem", "OS com status Entregue.", COLS_OSF, entByVal, rowOSF, `Total: ${mil(entregues.length)} OS entregues`),
  h_tk: mkDrill("Ticket médio — origem", "Ticket = faturamento total dividido pelo número de OS. Amostra dos maiores contratos.", COLS_OSF, allByVal, rowOSF, `Ticket: ${brl(DATA.ticket_medio)} = ${brl(DATA.faturamento_total)} / ${mil(DATA.os_total)}`),
  s_prazo: mkDrill("Prazo de entrega — origem", "OS entregues com prazo (fechamento → entrega) acima de 45 dias, das mais lentas para as mais rápidas.",
    ["Cliente", "Serviço", "Lead (dias)", "Valor (R$)"],
    entregues.filter(r => r.lead_time != null && r.lead_time > 45).sort((a, b) => b.lead_time - a.lead_time),
    r => [cNome(r), String(r.sintetico || '-'), mil(r.lead_time), brl(r.valor)],
    `${DATA.lead.pct45}% das entregues acima de 45 dias · mediana ${DATA.lead.mediana} d, p90 ${DATA.lead.p90} d`),
};

F1.drills = {
  r_rec: mkDrill("Receita recorrente 12m — origem", "Renovações a vencer nos próximos 12 meses (0–365 dias), por valor.", COLS_REN, ren0_365, rowREN, `Receita recorrente projetada: ${brl(renovacao.rec12m)}`),
  r_venc: mkDrill("Renovações vencidas — origem", "Renovações já vencidas e ainda em aberto (vencimento no passado), por valor.", COLS_REN, renVenc, rowREN, `${mil(renovacao.vencidos)} renovações vencidas em aberto`),
  r_90: mkDrill("Vencem em 90 dias — origem", "Renovações que vencem nos próximos 90 dias (0–90).", COLS_REN, ren0_90, rowREN, `${mil(renovacao.vence90)} renovações na janela de 90 dias`),
  r_val90: mkDrill("Valor na janela de 90 dias — origem", "Valor das renovações que vencem nos próximos 90 dias.", COLS_REN, ren0_90, rowREN, `${brl(renovacao.valor90)} em ${mil(renovacao.vence90)} renovações`),
  b_val: mkDrill("Valor represado no backlog — origem", "OS vendidas e ainda não entregues (status A realizar), priorizadas por valor × idade × prestador.", COLS_BK, ar, rowBK, `Total: ${brl(backlogF1.valor)} em ${mil(backlogF1.qtd)} OS`),
  b_qtd: mkDrill("OS a realizar — origem", "OS com status A realizar, das mais antigas para as mais novas.", COLS_BK, [...ar].sort((a, b) => (b.idade_dias || 0) - (a.idade_dias || 0)), rowBK, `${mil(backlogF1.qtd)} OS a realizar`),
  b_prest: mkDrill("Prestadores (prioridade) — origem", "OS a realizar de clientes prestadores de serviço (maior risco de ficar parada).", COLS_BK, ar.filter(r => r.prestador), rowBK, `${mil(backlogF1.prest_qtd)} OS · ${brl(backlogF1.prest_valor)}`),
  b_top20: mkDrill("Concentração top 20 — origem", "As 20 OS de maior prioridade do backlog (valor × idade × prestador).", COLS_BK, ar.slice(0, 20), rowBK, `Top 20: ${brl(backlogF1.top20)}`),
  x_psico: mkDrill("Clientes sem psicossocial — origem", "Clientes ativos (com PCMSO ou PGR) que ainda não fizeram o psicossocial, por valor.", COLS_CS, [...semPsico].sort(byValDesc), rowCS, `${mil(crosssell.sem_psico)} clientes · ${String(crosssell.pct_psico).replace('.', ',')}% dos ativos`),
  x_pcmso: mkDrill("Têm PCMSO, sem PGR — origem", "Clientes com PCMSO mas sem PGR.", COLS_CS, cli.filter(c => c.tem_pcmso && !c.tem_pgr).sort(byValDesc), rowCS, `${mil(crosssell.pcmso_sem_pgr)} clientes`),
  x_pgr: mkDrill("Têm PGR, sem PCMSO — origem", "Clientes com PGR mas sem PCMSO.", COLS_CS, cli.filter(c => c.tem_pgr && !c.tem_pcmso).sort(byValDesc), rowCS, `${mil(crosssell.pgr_sem_pcmso)} clientes`),
  x_cli: mkDrill("Clientes na base — origem", "Todos os clientes com código de cadastro, por valor acumulado.", ["Cliente", "Nº de serviços", "Valor (R$)"], [...cli].sort(byValDesc), c => [pyTitle(String(c.nome || '').slice(0, 34)), mil(c.tipos.size), brl(c.valor)], `${mil(crosssell.clientes)} clientes`),
  q_cnpj: mkDrill("OS sem CNPJ — origem", "OS sem CNPJ preenchido.", COLS_OSF, canon.filter(r => r.cnpj == null).sort(byValDesc), rowOSF, `${mil(qualidade.sem_cnpj)} OS sem CNPJ · ${String(qualidade.pct_cnpj).replace('.', ',')}%`),
  q_dup: mkDrill("Clientes duplicados — origem", "Clientes com o mesmo nome e mais de um código de cadastro.", ["Cliente", "Códigos distintos"], [...dupList].sort((a, b) => b[1] - a[1]), d => [pyTitle(String(d[0]).slice(0, 40)), mil(d[1])], `${mil(qualidade.multi)} clientes · ${mil(qualidade.extras)} códigos extras`),
  q_zero: mkDrill("OS com valor zero — origem", "OS com valor igual a zero.", ["Cliente", "Serviço", "Fechamento", "Status"], canon.filter(r => r.valor === 0).sort((a, b) => (b.dt_fechamento || 0) - (a.dt_fechamento || 0)), r => [cNome(r), String(r.sintetico || '-'), fmtDate(r.dt_fechamento), String(r.status || '-')], `${mil(qualidade.valor_zero)} OS com valor zero`),
  q_data: mkDrill("Entregues sem data — origem", "OS com status Entregue mas sem data de entrega registrada.", COLS_OSF, entregues.filter(r => r.dt_entrega == null).sort(byValDesc), rowOSF, `${mil(qualidade.sem_data)} OS entregues sem data`),
};

// ================= saída =================
F1.fila_renov = filaRenov;
const payload = { DATA, F1, COM };
try { mkdirSync(dirname(OUT), { recursive: true }); } catch {}
writeFileSync(OUT, JSON.stringify(payload));
console.log('✅ payload gerado:', OUT);
console.log('   OS totais         :', DATA.os_total.toLocaleString('pt-BR'));
console.log('   Faturamento total :', brl(DATA.faturamento_total));
console.log('   Fat. jan–jul 2026 :', brl(totC), '·', mil(nC), 'contratos');
console.log('   Renov. vencidas   :', renovacao.vencidos, '· backlog', brl(backlogF1.valor), 'em', backlogF1.qtd, 'OS');
console.log('   Referência "hoje" :', HOJE.toISOString().slice(0, 10));
