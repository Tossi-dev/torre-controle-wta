const nf=new Intl.NumberFormat('pt-BR');
const int=n=>nf.format(Math.round(n));
const brl=n=>'R$ '+nf.format(Math.round(n));
function brlC(n){ if(n>=1e6)return 'R$ '+(n/1e6).toFixed(2).replace('.',',')+' mi';
  if(n>=1e3)return 'R$ '+(n/1e3).toFixed(0)+' mil'; return 'R$ '+int(n); }
const days=n=> (Number.isInteger(n)?n:n.toFixed(1).replace('.',','))+' d';
const SC={good:'var(--good)',warning:'var(--warning)',serious:'var(--serious)',critical:'var(--critical)'};

const tip=document.getElementById('tip');
function bindTip(el,html){el.addEventListener('mousemove',e=>{tip.innerHTML=html;tip.style.opacity=1;
  tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-10)+'px';tip.style.top=(e.clientY+16)+'px';});
  el.addEventListener('mouseleave',()=>tip.style.opacity=0);}

function bars(elId,rows,{fmt,max,accentFn,tipFn}){
  const el=document.getElementById(elId); const mx=max||Math.max(...rows.map(r=>r.v))||1; el.innerHTML='';
  rows.forEach(r=>{
    const row=document.createElement('div');row.className='row';
    const soft=accentFn&&!accentFn(r);
    row.innerHTML=`<div class="rl" title="${r.l}">${r.l}</div>
      <div class="track"><div class="fill" style="width:${Math.max(2,r.v/mx*100)}%;${soft?'background:var(--bar-soft)':''}"></div></div>
      <div class="rv">${fmt(r.v)}</div>`;
    bindTip(row,tipFn?tipFn(r):`<b>${r.l}</b> — ${fmt(r.v)}`);
    el.appendChild(row);
  });
}

// ---------- VISÃO GERAL ----------
document.getElementById('dt').textContent=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
document.getElementById('h_fat').textContent=brlC(DATA.faturamento_total);
document.getElementById('h_fatnote').textContent='2026: '+brlC(DATA.valor_por_ano[2026])+' · maior ano registrado';
document.getElementById('h_os').textContent=int(DATA.os_total);
document.getElementById('h_ent').innerHTML=int(DATA.status.Entregue)+' <small>'+Math.round(DATA.status.Entregue/DATA.os_total*100)+'%</small>';
document.getElementById('h_tk').textContent=brl(DATA.ticket_medio);
document.getElementById('s_backlog').textContent=brlC(DATA.backlog.valor);
document.getElementById('s_backlog_d').textContent=`${int(DATA.backlog.qtd)} OS a realizar · ${DATA.backlog.d90} paradas há +90 dias.`;
document.getElementById('s_prazo').textContent=DATA.lead.pct45+'% > 45 dias';
document.getElementById('s_prazo_d').textContent=`Mediana ${DATA.lead.mediana} d, média ${Math.round(DATA.lead.media)} d, p90 ${DATA.lead.p90} d.`;
document.getElementById('s_ren').textContent=String(DATA.renov_cobertura).replace('.',',')+'% com vencimento';
document.getElementById('s_ren_d').textContent='37% do volume é renovação, mas o vencimento quase não era registrado. Veja a aba Renovações.';
bars('c_gargalos',DATA.gargalos.map(g=>({l:g[0],v:g[1],hl:g[2]})),{fmt:days,max:45,accentFn:r=>r.hl,
  tipFn:r=>`<b>${r.l}</b><br>${days(r.v)} em média ${r.hl?'· gargalo':''}`});
bars('c_mix',Object.entries(DATA.mix).map(([l,v])=>({l,v})),{fmt:int,tipFn:r=>`<b>${r.l}</b> — ${int(r.v)} OS`});
(function(){const el=document.getElementById('c_ano');const ys=Object.keys(DATA.valor_por_ano);
  const mx=Math.max(...ys.map(y=>DATA.valor_por_ano[y]));
  el.innerHTML=ys.map(y=>{const v=DATA.valor_por_ano[y];const hl=(y==='2026');
    return `<div class="col ${hl?'hl':''}"><div class="cv">${brlC(v)}</div>
      <div class="bar" style="height:${Math.max(3,v/mx*140)}px" data-y="${y}"></div><div class="cx">${y}</div></div>`;}).join('');
  [...el.querySelectorAll('.bar')].forEach(b=>{const y=b.dataset.y;
    bindTip(b,`<b>${y}</b><br>${brl(DATA.valor_por_ano[y])} · ${int(DATA.os_por_ano[y])} OS`);});})();
(function(){const nv=DATA.novo_renov.Novo,rn=DATA.novo_renov["Renovação"],tot=nv+rn;const pct=Math.round(rn/tot*100);
  document.getElementById('c_donut').style.setProperty('--p',pct+'%');
  document.getElementById('d_pct').textContent=pct+'%';
  document.getElementById('c_leg').innerHTML=`<div class="li"><span class="sw" style="background:var(--brand)"></span> Renovação &nbsp;<b>${int(rn)}</b></div>
    <div class="li"><span class="sw" style="background:var(--track)"></span> Novo &nbsp;<b>${int(nv)}</b></div>
    <div class="li" style="color:var(--muted);font-size:12px">Total ${int(tot)} OS</div>`;})();

// ---------- RENOVAÇÕES ----------
const R=F1.renovacao;
document.getElementById('r_rec').textContent=brlC(R.rec12m);
document.getElementById('r_venc').textContent=int(R.vencidos);
document.getElementById('r_90').textContent=int(R.vence90);
document.getElementById('r_val90').textContent=brlC(R.valor90);
(function(){const mx=Math.max(...R.buckets.map(b=>b[1]));
  document.getElementById('r_buckets').innerHTML=R.buckets.map(b=>`
    <div class="s"><div class="ic" style="background:${SC[b[2]]}"></div>
      <div><div class="sl">${b[0]}</div><div class="st"><div class="sf" style="width:${b[1]/mx*100}%;background:${SC[b[2]]}"></div></div></div>
      <div class="sv">${int(b[1])}</div></div>`).join('');})();
bars('r_tipo',Object.entries(R.por_tipo).map(([l,v])=>({l,v})),{fmt:int,tipFn:r=>`<b>${r.l}</b> — ${int(r.v)} a renovar (90d)`});
document.getElementById('r_tbl').innerHTML=F1.top_ren.map(r=>{const d=r[2];
  const sit=d<0?`<span class="over">vencido há ${-d}d</span>`:`<span class="soon">vence em ${d}d</span>`;
  return `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${sit}</td><td class="n">${brl(r[3])}</td></tr>`;}).join('');

// ---------- BACKLOG ----------
const B=F1.backlog;
document.getElementById('b_val').textContent=brlC(B.valor);
document.getElementById('b_note').textContent=`${int(B.qtd)} OS a realizar · serviço vendido e não entregue.`;
document.getElementById('b_qtd').textContent=int(B.qtd);
document.getElementById('b_prest').innerHTML=int(B.prest_qtd)+' <small>'+brlC(B.prest_valor)+'</small>';
document.getElementById('b_top20').textContent=brlC(B.top20);
document.getElementById('b_tbl').innerHTML=F1.top_bk.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td>
  <td class="n">${brl(r[2])}</td><td class="n">${int(r[3])} d</td>
  <td>${r[4]?'<span class="badge">prestador</span>':''}</td></tr>`).join('');

// ---------- CROSS-SELL ----------
const X=F1.crosssell;
document.getElementById('x_psico').textContent=int(X.sem_psico);
document.getElementById('x_psico_n').textContent=`${String(X.pct_psico).replace('.',',')}% dos clientes ativos ainda não fizeram o psicossocial.`;
document.getElementById('x_pcmso').textContent=int(X.pcmso_sem_pgr);
document.getElementById('x_pgr').textContent=int(X.pgr_sem_pcmso);
document.getElementById('x_cli').textContent=int(X.clientes);
document.getElementById('x_tbl').innerHTML=F1.top_cs.map(r=>{
  const chips=r[1].split(',').map(g=>`<span class="chip">${g}</span>`).join('');
  return `<tr><td>${r[0]}</td><td>${chips}</td><td class="n">${brl(r[2])}</td></tr>`;}).join('');

// ---------- QUALIDADE ----------
const Q=F1.qualidade;
document.getElementById('q_cnpj').textContent=String(Q.pct_cnpj).replace('.',',')+'%';
document.getElementById('q_cnpj_n').textContent=`${int(Q.sem_cnpj)} OS sem CNPJ — trava conciliação e integração.`;
document.getElementById('q_dup').innerHTML=int(Q.multi)+' <small>+'+int(Q.extras)+' códigos</small>';
document.getElementById('q_zero').textContent=int(Q.valor_zero);
document.getElementById('q_data').textContent=int(Q.sem_data);
bars('q_tbl',Q.dup.map(d=>({l:d[0],v:d[1]})),{fmt:v=>int(v)+' códigos',tipFn:r=>`<b>${r.l}</b><br>${r.v} códigos diferentes p/ o mesmo cliente`});

// ---------- nav + tema ----------
document.getElementById('nav').addEventListener('click',e=>{const t=e.target.closest('.tab');if(!t)return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('v-'+t.dataset.v).classList.add('active');window.scrollTo(0,0);});
document.getElementById('tg').addEventListener('click',()=>{const r=document.documentElement;
  r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';});

// ===== COMERCIAL (aba 1) =====
(function(){
  if(typeof COM==='undefined') return;
  var el=document.getElementById('c_ckpis');
  el.innerHTML=COM.kpis.map(function(k){
    var up=k.delta>=0, cls=(k.dir==='cima')?(up?'up':'down'):(up?'down':'up');
    var ar=Math.abs(k.delta)<0.05?'▬':(up?'▲':'▼');
    return '<div class="ckpi" data-d="'+k.drill+'"><div class="lab">'+k.label+'</div><div class="v">'+k.val+'</div>'
      +'<div class="cp">'+k.comp+'</div>'
      +'<div class="cmp"><span class="dl '+cls+'">'+ar+' '+Math.abs(k.delta).toFixed(1).replace('.',',')+'%</span>vs 2025 ('+k.ref+')</div>'
      +'<div class="vo">ver origem ▸</div></div>';
  }).join('');
  el.querySelectorAll('.ckpi').forEach(function(c){c.addEventListener('click',function(){abrir(c.dataset.d);});});
  document.getElementById('c_linha').innerHTML=svgLine(COM.mensal);
  var mix=COM.mix, tot=mix.reduce(function(a,b){return a+b[1];},0);
  var cols=['var(--r1)','var(--r2)','var(--r3)','var(--r4)','var(--r5)','var(--r6)'];
  var acc=0,segs=[];
  mix.forEach(function(m,i){var p=m[1]/tot*100;segs.push(cols[i]+' '+acc+'% '+(acc+p)+'%');acc+=p;});
  document.getElementById('c_mixdonut').style.background='conic-gradient('+segs.join(',')+')';
  document.getElementById('c_mixleg').innerHTML=mix.map(function(m,i){return '<div class="li"><span class="sw" style="background:'+cols[i]+'"></span> '+m[0]+' &nbsp;<b>'+brlC(m[1])+'</b></div>';}).join('');
  bars('c_vend',COM.vendedores.map(function(v){return {l:v[0],v:v[1],n:v[2],tk:v[3]};}),
    {fmt:brlC,tipFn:function(r){return '<b>'+r.l+'</b><br>'+brl(r.v)+' · '+int(r.n)+' contratos · ticket '+brl(r.tk);}});
  document.getElementById('c_vtbl').innerHTML=COM.vendedores.map(function(v){
    return '<tr class="drill" data-d="v_'+v[0].toUpperCase()+'"><td>'+v[0]+'</td><td class="n">'+int(v[2])+'</td><td class="n">'+brl(v[1])+'</td><td class="n">'+brl(v[3])+'</td><td class="n">'+String(v[4]).replace('.',',')+'%</td></tr>';
  }).join('');
  document.getElementById('c_vtbl').querySelectorAll('tr').forEach(function(tr){tr.addEventListener('click',function(){abrir(tr.dataset.d);});});
})();

function svgLine(m){
  var W=560,H=210,pl=54,pr=12,pt=14,pb=24,iw=W-pl-pr,ih=H-pt-pb;
  function axfmt(x){return x>=1e6?(x/1e6).toFixed(1).replace('.',',')+' mi':x>=1e3?Math.round(x/1e3)+' mil':'0';}
  var all=m.s2025.concat(m.s2026).filter(function(x){return x!=null;});
  var mx=Math.max.apply(null,all)*1.08,n=m.labels.length;
  function X(i){return pl+iw*(i/(n-1));}
  function Y(v){return pt+ih*(1-v/mx);}
  function path(s){var d='',st=false;s.forEach(function(v,i){if(v==null){st=false;return;}d+=(st?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)+' ';st=true;});return d;}
  var g='';
  [0,0.5,1].forEach(function(f){var y=pt+ih*(1-f);g+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="var(--grid)" stroke-width="1"/>';g+='<text x="'+(pl-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="9" fill="var(--muted)">'+axfmt(mx*f)+'</text>';});
  m.labels.forEach(function(l,i){if(i%2===0)g+='<text x="'+X(i)+'" y="'+(H-7)+'" text-anchor="middle" font-size="9" fill="var(--muted)">'+l+'</text>';});
  g+='<path class="ln25" d="'+path(m.s2025)+'" fill="none" stroke="var(--bar-soft)" stroke-width="2"/>';
  g+='<path class="ln26" d="'+path(m.s2026)+'" fill="none" stroke="var(--brand)" stroke-width="3"/>';
  m.s2026.forEach(function(v,i){if(v!=null)g+='<circle class="ldot" style="animation-delay:'+(1.05+i*0.09).toFixed(2)+'s" cx="'+X(i)+'" cy="'+Y(v)+'" r="3.6" fill="var(--brand)"/>';});
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">'+g+'</svg>';
}
// ---------- drill universal: todo KPI abre a origem ----------
window.DRILLS=Object.assign({},(window.COM&&COM.drills)||{},(window.DATA&&DATA.drills)||{},(window.F1&&F1.drills)||{});
[['h_fat','h_fat'],['h_os','h_os'],['h_ent','h_ent'],['h_tk','h_tk'],['s_backlog','b_val'],['s_prazo','s_prazo'],['s_ren','r_venc'],['r_rec','r_rec'],['r_venc','r_venc'],['r_90','r_90'],['r_val90','r_val90'],['b_val','b_val'],['b_qtd','b_qtd'],['b_prest','b_prest'],['b_top20','b_top20'],['x_psico','x_psico'],['x_pcmso','x_pcmso'],['x_pgr','x_pgr'],['x_cli','x_cli'],['q_cnpj','q_cnpj'],['q_dup','q_dup'],['q_zero','q_zero'],['q_data','q_data']].forEach(function(p){
  var el=document.getElementById(p[0]); if(!el)return; var card=el.closest('.card'); if(!card||card.classList.contains('clk'))return;
  if(!window.DRILLS[p[1]])return;
  card.classList.add('clk'); card.setAttribute('data-d',p[1]);
  var vo=document.createElement('div'); vo.className='vo'; vo.textContent='ver origem ▸'; card.appendChild(vo);
  card.addEventListener('click',function(){abrir(p[1]);});
});
function abrir(id){var d=(window.DRILLS&&window.DRILLS[id])||(window.COM&&COM.drills&&COM.drills[id]);if(!d)return;
  document.getElementById('dm-t').textContent=d.titulo;
  document.getElementById('dm-f').textContent=d.filtro;
  var last=d.cols.length-1;
  var h='<table><thead><tr>'+d.cols.map(function(c,i){return '<th class="'+(i===last?'n':'')+'">'+c+'</th>';}).join('')+'</tr></thead><tbody>';
  d.rows.forEach(function(r){h+='<tr>'+r.map(function(c,i){return '<td class="'+(i===last?'n hl':'')+'">'+c+'</td>';}).join('')+'</tr>';});
  h+='</tbody></table>';
  document.getElementById('dm-tb').innerHTML=h;
  document.getElementById('dm-r').textContent=d.rodape;
  document.getElementById('dm-n').textContent=d.nota||'';
  document.getElementById('dov').classList.add('open');
}
function fechar(){document.getElementById('dov').classList.remove('open');}
document.getElementById('dov').addEventListener('click',function(e){if(e.target===this)fechar();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')fechar();});

// ================================================================
// F2 — renovações vencidas viram tarefa + exportar planilha (.xlsx)
// ================================================================
var SB_URL="https://dopflrttbclvtyvzlysb.supabase.co";
var SB_KEY="sb_publishable_pwV8JpbQjnpQY2JXh_6qyA_0DygnmuI";
var TSK_STATUS=['Aberto','Em contato','Renovado','Perdido'];
var TSK_RESP=['—','Sidney','Bruna','Izabelle','Renata','Graziele','Savio'];
window.TASKS=window.TASKS||{};

function escH(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function brlF(n){return 'R$ '+new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}
function tskSync(state,msg){var el=document.getElementById('tsk_status');if(!el)return;
  el.className='tsk-sync'+(state?' '+state:'');el.textContent=msg;}
function optsFor(list,sel){return list.map(function(o){
  return '<option'+(o===sel?' selected':'')+'>'+escH(o)+'</option>';}).join('');}

function renderTarefas(){
  var tb=document.getElementById('r_tarefas'); if(!tb)return;
  var fila=(window.F1&&F1.fila_renov)||[]; var h='';
  fila.forEach(function(r){
    var t=window.TASKS[r.k]||{};
    var st=t.status||'Aberto', rp=t.responsavel||'—', dt=t.data_retorno||'';
    h+='<tr data-k="'+escH(r.k)+'" data-st="'+escH(st)+'">'
      +'<td class="cli">'+escH(r.cli)+'</td>'
      +'<td class="srv">'+escH(r.srv)+'</td>'
      +'<td><span class="tsk-dias">'+Math.abs(r.dias)+' d</span></td>'
      +'<td class="n">'+brlF(r.val)+'</td>'
      +'<td><select class="tsk-ctl tsk-st">'+optsFor(TSK_STATUS,st)+'</select></td>'
      +'<td><select class="tsk-ctl tsk-rp">'+optsFor(TSK_RESP,rp)+'</select></td>'
      +'<td><input type="date" class="tsk-ctl tsk-dt" value="'+escH(dt)+'"></td>'
      +'</tr>';
  });
  tb.innerHTML=h;
}

function bindTarefas(){
  var tb=document.getElementById('r_tarefas'); if(!tb||tb.__wired)return; tb.__wired=true;
  tb.addEventListener('change',function(e){
    var tr=e.target.closest('tr[data-k]'); if(!tr)return;
    var k=tr.getAttribute('data-k');
    var fila=(window.F1&&F1.fila_renov)||[], ctx=null;
    for(var i=0;i<fila.length;i++){if(fila[i].k===k){ctx=fila[i];break;}}
    var cur=window.TASKS[k]||{};
    if(e.target.classList.contains('tsk-st')) cur.status=e.target.value;
    else if(e.target.classList.contains('tsk-rp')) cur.responsavel=e.target.value;
    else if(e.target.classList.contains('tsk-dt')) cur.data_retorno=e.target.value||null;
    window.TASKS[k]=cur;
    if(cur.status) tr.setAttribute('data-st',cur.status);
    saveTask(k,ctx);
  });
}

function saveTask(k,ctx){
  var cur=window.TASKS[k]||{};
  var body=[{
    item_key:k, tipo:'renovacao_vencida',
    cliente:ctx?ctx.cli:null, servico:ctx?ctx.srv:null,
    status:cur.status||'Aberto',
    responsavel:(cur.responsavel&&cur.responsavel!=='—')?cur.responsavel:null,
    data_retorno:cur.data_retorno||null,
    nota:cur.nota||null
  }];
  tskSync('busy','salvando…');
  fetch(SB_URL+'/rest/v1/task',{method:'POST',
    headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json',
      'Prefer':'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(body)})
  .then(function(r){ if(r.ok) tskSync('ok','salvo'); else tskSync('err','erro ao salvar ('+r.status+')'); })
  .catch(function(){ tskSync('err','offline — salvo só neste navegador'); });
}

function loadTasks(cb){
  tskSync('busy','carregando…');
  fetch(SB_URL+'/rest/v1/task?select=item_key,status,responsavel,data_retorno,nota',
    {headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}})
  .then(function(r){ return r.ok?r.json():Promise.reject(r.status); })
  .then(function(rows){
    (rows||[]).forEach(function(t){ window.TASKS[t.item_key]={status:t.status,responsavel:t.responsavel,data_retorno:t.data_retorno,nota:t.nota}; });
    tskSync('ok', (rows&&rows.length?rows.length+' tarefas · ':'')+'sincronizado');
    if(cb)cb();
  })
  .catch(function(){ tskSync('err','offline — mudanças ficam só neste navegador'); if(cb)cb(); });
}

// ---------- exportar planilha (.xlsx) — SheetJS carregado sob demanda ----------
function loadXLSX(cb){
  if(window.XLSX){cb();return;}
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload=function(){cb();}; s.onerror=function(){cb(new Error('cdn'));};
  document.head.appendChild(s);
}
function doExport(){
  var btn=document.getElementById('btn_export'), note=document.getElementById('exp_note');
  if(btn) btn.disabled=true; if(note) note.textContent='Gerando o arquivo…';
  loadXLSX(function(err){
    if(err){ if(note) note.textContent='Não consegui carregar o gerador de Excel (sem internet?). Tente de novo.'; if(btn) btn.disabled=false; return; }
    try{
      var wb=XLSX.utils.book_new();
      var resumo=[
        ['Torre de Controle WTA — exportação'],
        ['Gerado em', new Date().toLocaleString('pt-BR')],
        [],
        ['Indicador','Valor'],
        ['Faturamento total', DATA.faturamento_total],
        ['OS totais', DATA.os_total],
        ['Ticket médio', DATA.ticket_medio],
        ['Renovações vencidas (em aberto)', F1.renovacao.vencidos],
        ['Receita recorrente projetada 12m', F1.renovacao.rec12m],
        ['Valor represado no backlog', F1.backlog.valor],
        ['OS a realizar', F1.backlog.qtd],
        ['Clientes sem psicossocial', F1.crosssell.sem_psico],
        ['OS sem CNPJ', F1.qualidade.sem_cnpj]
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
      var fila=(F1.fila_renov||[]);
      var rv=[['Cliente','Documento','Vencida há (dias)','Valor (R$)','Status','Responsável','Retorno']];
      fila.forEach(function(r){var t=window.TASKS[r.k]||{};
        rv.push([r.cli,r.srv,Math.abs(r.dias),r.val,t.status||'Aberto',(t.responsavel&&t.responsavel!=='—')?t.responsavel:'',t.data_retorno||'']);});
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rv), 'Renovações vencidas');
      var bk=[['Cliente','Documento','Valor (R$)','Parada há (dias)','Prestador']];
      (F1.top_bk||[]).forEach(function(r){bk.push([r[0],r[1],r[2],r[3],r[4]?'Sim':'Não']);});
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bk), 'Dinheiro parado');
      var cs=[['Cliente','Falta','Valor histórico (R$)']];
      (F1.top_cs||[]).forEach(function(r){cs.push([r[0],r[1],r[2]]);});
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cs), 'Cross-sell');
      var cm=[['Vendedor','Faturamento (R$)','Contratos','Ticket (R$)','Renov. (%)']];
      (COM.vendedores||[]).forEach(function(r){cm.push([r[0],r[1],r[2],r[3],r[4]]);});
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cm), 'Comercial');
      var d=new Date(), pad=function(n){return (n<10?'0':'')+n;};
      var fn='WTA_Torre_de_Controle_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'.xlsx';
      XLSX.writeFile(wb, fn);
      if(note) note.textContent='Pronto! Baixado como '+fn+'.';
    }catch(ex){ if(note) note.textContent='Erro ao gerar a planilha: '+ex.message; }
    if(btn) btn.disabled=false;
  });
}

// ---------- init F2 ----------
(function(){
  try{ renderTarefas(); bindTarefas(); loadTasks(renderTarefas); }catch(e){ console.error('F2 tarefas',e); }
  var be=document.getElementById('btn_export'); if(be&&!be.__wired){ be.__wired=true; be.addEventListener('click',doExport); }
})();
