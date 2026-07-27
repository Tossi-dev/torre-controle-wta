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
  renderResumo();
}
function renderResumo(){
  var el=document.getElementById('r_resumo'); if(!el) return;
  var fila=(window.F1&&F1.fila_renov)||[];
  var stats={'Aberto':{n:0,v:0},'Em contato':{n:0,v:0},'Renovado':{n:0,v:0},'Perdido':{n:0,v:0}};
  fila.forEach(function(r){ var t=window.TASKS[r.k]||{}; var s=t.status||'Aberto'; if(!stats[s]) s='Aberto'; stats[s].n++; stats[s].v+=(r.val||0); });
  var map=[['Aberto','A cobrar','aberto'],['Em contato','Em contato','contato'],['Renovado','Renovado','renovado'],['Perdido','Perdido','perdido']];
  el.innerHTML=map.map(function(m){ var s=stats[m[0]];
    return '<div class="est-st '+m[2]+'"><div class="en">'+s.n+'</div><div class="el">'+escH(m[1])+'</div><div class="ev">'+brlF(s.v)+'</div></div>';
  }).join('');
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
    renderResumo();
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
    headers:{apikey:SB_KEY,Authorization:'Bearer '+((window.WAUTH&&WAUTH.token())||SB_KEY),'Content-Type':'application/json',
      'Prefer':'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(body)})
  .then(function(r){ if(r.ok) tskSync('ok','salvo'); else tskSync('err','erro ao salvar ('+r.status+')'); })
  .catch(function(){ tskSync('err','offline — salvo só neste navegador'); });
}

function loadTasks(cb){
  tskSync('busy','carregando…');
  fetch(SB_URL+'/rest/v1/task?select=item_key,status,responsavel,data_retorno,nota',
    {headers:{apikey:SB_KEY,Authorization:'Bearer '+((window.WAUTH&&WAUTH.token())||SB_KEY)}})
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
  try{ renderTarefas(); bindTarefas(); loadTasks(function(){ renderTarefas(); if(window.renderVendas) window.renderVendas(); }); }catch(e){ console.error('F2 tarefas',e); }
  var be=document.getElementById('btn_export'); if(be&&!be.__wired){ be.__wired=true; be.addEventListener('click',doExport); }
})();

// ================================================================
// F3 — gate por papel (área Dados só admin) + chip de usuário/sair
// ================================================================
(function(){
  try{
    var u=(window.WAUTH&&WAUTH.user&&WAUTH.user())||null;
    if(!u) return; // login desligado (painel público): mostra tudo, sem chip
    var prof=(window.WAUTH&&WAUTH.profile&&WAUTH.profile())||null;
    var papel=prof&&prof.papel;
    // vendas: esconder as abas de gestão e abrir direto no painel de Vendas
    if(papel!=='admin'){
      ['dados','geral','backlog','qual'].forEach(function(v){
        var tb=document.querySelector('.tab[data-v="'+v+'"]'); if(tb) tb.style.display='none';
        var vw=document.getElementById('v-'+v); if(vw){ vw.style.display='none'; vw.classList.remove('active'); }
      });
      var tv=document.querySelector('.tab[data-v="vendas"]'); if(tv) tv.click();
    }
    // chip de usuário + Sair na barra de topo
    var right=document.querySelector('.appbar .right');
    if(right&&!document.getElementById('usr_chip')){
      var c=document.createElement('div'); c.className='usr-chip'; c.id='usr_chip';
      var papelTxt=papel?(' · '+papel):'';
      c.innerHTML='<span class="em">'+escH(u.email||'')+escH(papelTxt)+'</span><button class="out" id="usr_out">Sair</button>';
      right.appendChild(c);
      document.getElementById('usr_out').addEventListener('click',function(){
        if(window.WAUTH) WAUTH.logout().then(function(){ location.reload(); }); else location.reload();
      });
    }
  }catch(e){ console.error('F3 gate papel',e); }
})();

// ================================================================
// Dados — planilha viva (link+embed) + lançamento rápido
// ================================================================
(function(){
  var LC_SRV=['PCMSO','PGR','LTCAT','psicossocial','Treinamento','Gestão','Adendo','PPP','CAT','PCA','Consultoria','Ordem de Serviço','Outro'];
  var LC_VEND=['—','Sidney','Bruna','Izabelle','Renata','Graziele','Savio'];
  function authHdr(json){ var h={apikey:SB_KEY, Authorization:'Bearer '+((window.WAUTH&&WAUTH.token())||SB_KEY)}; if(json) h['Content-Type']='application/json'; return h; }
  function opt(list,el){ if(!el)return; el.innerHTML=list.map(function(o){return '<option>'+escH(o)+'</option>';}).join(''); }

  // ---- planilha viva (config) ----
  function gsEmbedUrl(u){ try{ if(/docs\.google\.com\/spreadsheets/.test(u)) return u.replace(/\/(edit|htmlview|view)[^]*$/,'/preview'); }catch(e){} return u; }
  function renderGs(url){
    var row=document.getElementById('gs_url'), act=document.getElementById('gs_actions'), emb=document.getElementById('gs_embed'), open=document.getElementById('gs_open');
    if(!row) return;
    if(url){ row.value=url; if(act) act.hidden=false; if(open) open.href=url;
      if(emb){ emb.hidden=false; emb.innerHTML='<iframe src="'+escH(gsEmbedUrl(url))+'" loading="lazy"></iframe>'; } }
    else { if(act) act.hidden=true; if(emb){ emb.hidden=true; emb.innerHTML=''; } }
  }
  function loadGs(){
    fetch(SB_URL+'/rest/v1/config?select=valor&chave=eq.planilha_url',{headers:authHdr(false)})
      .then(function(r){ return r.ok?r.json():[]; })
      .then(function(rows){ var v=rows&&rows[0]&&rows[0].valor; if(v) renderGs(v); }).catch(function(){});
  }
  function saveGs(url){
    return fetch(SB_URL+'/rest/v1/config',{method:'POST',
      headers:Object.assign(authHdr(true),{'Prefer':'resolution=merge-duplicates,return=minimal'}),
      body:JSON.stringify([{chave:'planilha_url', valor:url}])});
  }

  // ---- lançamento ----
  function renderLanc(rows){
    var tb=document.getElementById('lanc_list'); if(!tb)return;
    if(!rows||!rows.length){ tb.innerHTML='<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px">Nenhum lançamento ainda.</td></tr>'; return; }
    tb.innerHTML=rows.map(function(r){
      return '<tr><td class="cli">'+escH(r.cliente||'')+'</td><td class="srv">'+escH(r.servico||'')+'</td>'
        +'<td class="n">'+(r.valor!=null?brlF(r.valor):'-')+'</td><td>'+escH((r.vendedor&&r.vendedor!=='—')?r.vendedor:'')+'</td></tr>';
    }).join('');
  }
  function loadLanc(){
    fetch(SB_URL+'/rest/v1/lancamento?select=cliente,servico,valor,vendedor,data,status&order=criado.desc&limit=30',{headers:authHdr(false)})
      .then(function(r){ return r.ok?r.json():[]; }).then(renderLanc).catch(function(){ renderLanc([]); });
  }
  function saveLanc(obj){
    return fetch(SB_URL+'/rest/v1/lancamento',{method:'POST',
      headers:Object.assign(authHdr(true),{'Prefer':'return=minimal'}), body:JSON.stringify([obj])});
  }

  // ---- ingestão (upload de planilha → recalcula → grava snapshot → recarrega) ----
  var _ingPayload=null;
  function loadETL(cb){
    function step2(){ if(window.WTA_ETL) return cb(); var s=document.createElement('script'); s.src='etl_browser.js'; s.onload=function(){cb();}; s.onerror=function(){cb(new Error('etl'));}; document.head.appendChild(s); }
    if(window.XLSX) return step2();
    var x=document.createElement('script'); x.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    x.onload=step2; x.onerror=function(){ cb(new Error('xlsx')); }; document.head.appendChild(x);
  }
  function ingStatus(t){ var e=document.getElementById('ing_status'); if(e) e.textContent=t||''; }
  function ingConfirm(){
    if(!_ingPayload) return;
    var c=document.getElementById('ing_confirm'); if(c) c.disabled=true; ingStatus('Gravando…');
    fetch(SB_URL+'/rest/v1/snapshot',{method:'POST',
      headers:Object.assign(authHdr(true),{'Prefer':'return=minimal'}),
      body:JSON.stringify([{ payload:_ingPayload.payload, source_file:_ingPayload.source_file }])})
    .then(function(r){ if(r.ok){ ingStatus('Atualizado! Recarregando o painel…'); setTimeout(function(){ location.reload(); },1000); }
      else { ingStatus('Erro ao gravar ('+r.status+').'+((r.status===401||r.status===403)?' Entre como admin.':'')); if(c) c.disabled=false; } })
    .catch(function(){ ingStatus('Sem conexão ao gravar. Tente de novo.'); if(c) c.disabled=false; });
  }
  function doIngest(){
    var fi=document.getElementById('ing_file'), f=fi&&fi.files&&fi.files[0], btn=document.getElementById('ing_btn'), pv=document.getElementById('ing_preview');
    if(!f){ ingStatus('Escolha uma planilha (.xlsx).'); return; }
    if(btn) btn.disabled=true; if(pv){ pv.hidden=true; pv.innerHTML=''; } ingStatus('Lendo e recalculando…');
    loadETL(function(err){
      if(err){ ingStatus('Não consegui carregar o motor (sem internet?). Tente de novo.'); if(btn) btn.disabled=false; return; }
      f.arrayBuffer().then(function(buf){
        try{
          var p=window.WTA_ETL(buf, new Date(), 12);
          _ingPayload={ payload:p, source_file:f.name };
          var D=p.DATA, Q=p.F1.qualidade;
          ingStatus('');
          pv.hidden=false;
          pv.innerHTML='<div class="ing-nums">'
            +'<div><b>'+int(D.os_total)+'</b><span>OS na base</span></div>'
            +'<div><b>'+brlC(D.faturamento_total)+'</b><span>faturamento total</span></div>'
            +'<div><b>'+int(p.F1.renovacao.vencidos)+'</b><span>renov. vencidas</span></div>'
            +'</div>'
            +'<div class="ing-qual">Guardião de qualidade: '+int(Q.sem_cnpj)+' OS sem CNPJ · '+int(Q.valor_zero)+' com valor zero · '+int(Q.sem_data)+' entregues sem data. Confira antes de confirmar.</div>'
            +'<button id="ing_confirm" class="btn-exp" type="button">Confirmar e atualizar o painel</button>';
          document.getElementById('ing_confirm').addEventListener('click', ingConfirm);
        }catch(ex){ ingStatus('Erro ao processar: '+(ex&&ex.message||ex)); }
        if(btn) btn.disabled=false;
      }).catch(function(){ ingStatus('Não consegui ler o arquivo.'); if(btn) btn.disabled=false; });
    });
  }

  // ---- init ----
  opt(LC_SRV, document.getElementById('lc_srv'));
  opt(LC_VEND, document.getElementById('lc_vend'));
  var ib=document.getElementById('ing_btn'); if(ib&&!ib.__w){ ib.__w=1; ib.addEventListener('click', doIngest); }
  var gsSave=document.getElementById('gs_save');
  if(gsSave&&!gsSave.__w){ gsSave.__w=1; gsSave.addEventListener('click',function(){
    var u=(document.getElementById('gs_url').value||'').trim(); if(!u) return;
    gsSave.disabled=true; saveGs(u).then(function(){ renderGs(u); }).catch(function(){}).then(function(){ gsSave.disabled=false; });
  }); }
  var gsClear=document.getElementById('gs_clear');
  if(gsClear&&!gsClear.__w){ gsClear.__w=1; gsClear.addEventListener('click',function(){
    saveGs('').catch(function(){}); renderGs(''); var f=document.getElementById('gs_url'); if(f){ f.value=''; f.focus(); }
  }); }
  var lf=document.getElementById('lanc_form');
  if(lf&&!lf.__w){ lf.__w=1; lf.addEventListener('submit',function(e){ e.preventDefault();
    var msg=document.getElementById('lc_msg'), btn=document.getElementById('lc_btn');
    var obj={ cliente:(document.getElementById('lc_cli').value||'').trim(),
      servico:document.getElementById('lc_srv').value,
      valor:parseFloat(document.getElementById('lc_val').value)||null,
      data:document.getElementById('lc_data').value||null,
      vendedor:document.getElementById('lc_vend').value,
      status:document.getElementById('lc_status').value };
    if(!obj.cliente){ if(msg){msg.className='lanc-msg err';msg.textContent='Informe o cliente.';} return; }
    if(obj.vendedor==='—') obj.vendedor=null;
    if(btn) btn.disabled=true; if(msg){msg.className='lanc-msg';msg.textContent='Salvando…';}
    saveLanc(obj).then(function(r){ if(btn)btn.disabled=false;
      if(r.ok){ if(msg){msg.className='lanc-msg ok';msg.textContent='Lançamento salvo.';} lf.reset(); loadLanc(); }
      else { if(msg){msg.className='lanc-msg err';msg.textContent='Erro ao salvar ('+r.status+').';} }
    }).catch(function(){ if(btn)btn.disabled=false; if(msg){msg.className='lanc-msg err';msg.textContent='Sem conexão — tente de novo.';} });
  }); }
  try{ loadGs(); loadLanc(); }catch(e){ console.error('Dados init',e); }
})();

// ================================================================
// F1 protótipo — gerar documento (ASO) no navegador (docxtemplater)
// ================================================================
(function(){
  function loadDocxLibs(cb){
    if(window.docxtemplater && window.PizZip){ cb(); return; }
    var srcs=['https://unpkg.com/pizzip@3.2.0/dist/pizzip.min.js',
              'https://unpkg.com/docxtemplater@3.69.3/build/docxtemplater.min.js'];
    var i=0;
    (function next(){
      if(i>=srcs.length){ cb(); return; }
      var s=document.createElement('script'); s.src=srcs[i++];
      s.onload=next; s.onerror=function(){ cb(new Error('cdn')); };
      document.head.appendChild(s);
    })();
  }
  function b64ToU8(b64){ var bin=atob(b64), a=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i); return a; }
  function doGerarDoc(){
    var btn=document.getElementById('dc_btn'), msg=document.getElementById('dc_msg');
    if(!window.ASO_TPL_B64 || window.ASO_TPL_B64.indexOf('__ASO_TPL')===0){ if(msg){msg.className='lanc-msg err';msg.textContent='Template não carregado.';} return; }
    if(btn) btn.disabled=true; if(msg){msg.className='lanc-msg';msg.textContent='Gerando…';}
    loadDocxLibs(function(err){
      if(err){ if(msg){msg.className='lanc-msg err';msg.textContent='Não consegui carregar o gerador (sem internet?). Tente de novo.';} if(btn)btn.disabled=false; return; }
      try{
        var zip=new PizZip(b64ToU8(window.ASO_TPL_B64));
        var doc=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true});
        var hj=new Date(), pad=function(n){return(n<10?'0':'')+n;}, ds=pad(hj.getDate())+'/'+pad(hj.getMonth()+1)+'/'+hj.getFullYear();
        var val=function(id,fb){ var e=document.getElementById(id); return (e&&e.value)?e.value:fb; };
        doc.render({
          razao_social:val('dc_emp','—'), cnpj:'12.345.678/0001-90', cnae:'4930-2/02',
          endereco:'Av. das Indústrias, 1000 - Uberlândia/MG',
          nome_trabalhador:val('dc_nome','—'), cpf:'123.456.789-00', nascimento:'15/03/1988',
          cargo:val('dc_cargo','—'), setor:'Operacional', riscos:'Ruído; Vibração de corpo inteiro',
          tipo_exame:val('dc_tipo','Periódico'), data_exame:ds, exames_complementares:'Audiometria; Acuidade Visual',
          conclusao:val('dc_concl','APTO para a função'), observacoes:'Uso obrigatório de EPI conforme a função',
          medico:'Dra. Maria Souza', crm:'CRM-MG 123456', data_emissao:ds
        });
        var blob=doc.getZip().generate({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
        var url=URL.createObjectURL(blob), a=document.createElement('a');
        a.href=url; a.download='ASO_'+val('dc_nome','trabalhador').replace(/\s+/g,'_')+'.docx';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); if(a.parentNode)a.parentNode.removeChild(a); },1000);
        if(msg){msg.className='lanc-msg ok';msg.textContent='ASO gerado e baixado.';}
      }catch(ex){ if(msg){msg.className='lanc-msg err';msg.textContent='Erro ao gerar: '+(ex&&ex.message||ex);} }
      if(btn)btn.disabled=false;
    });
  }
  var df=document.getElementById('doc_form');
  if(df&&!df.__w){ df.__w=1; df.addEventListener('submit',function(e){ e.preventDefault(); doGerarDoc(); }); }
})();

// ================================================================
// F3.1 — alertas "precisa de atenção" (calculados dos dados, clicáveis)
// ================================================================
(function(){
  try{
    var el=document.getElementById('alertas'); if(!el) return;
    var R=(window.F1&&F1.renovacao)||{}, B=(window.DATA&&DATA.backlog)||{}, X=(window.F1&&F1.crosssell)||{};
    var A=[];
    if(R.vencidos) A.push({sev:'crit', v:int(R.vencidos), l:'Renovações vencidas em aberto', h:'Recuperável — priorize por valor.', tab:'renov', drill:'r_venc'});
    if(R.vence90) A.push({sev:'warn', v:int(R.vence90), l:'Vencem nos próximos 90 dias', h:'Janela pra não perder a renovação.', tab:'renov', drill:'r_90'});
    if(B.d90) A.push({sev:'serious', v:int(B.d90)+' OS', l:'Paradas há mais de 90 dias', h:brlC(B.valor||0)+' represados no backlog.', tab:'backlog', drill:'b_qtd'});
    if(X.sem_psico) A.push({sev:'op', v:int(X.sem_psico), l:'Clientes sem psicossocial', h:'Exigência nova — venda esperando contato.', tab:'cross', drill:'x_psico'});
    if(!A.length){ el.innerHTML='<div class="alerta" style="cursor:default">Tudo em dia por aqui.</div>'; return; }
    el.innerHTML=A.map(function(a){
      return '<div class="alerta '+a.sev+'" data-tab="'+escH(a.tab)+'" data-drill="'+escH(a.drill||'')+'">'
        +'<div class="av">'+escH(String(a.v))+'</div><div class="al">'+escH(a.l)+'</div>'
        +'<div class="ah">'+escH(a.h)+'</div><div class="ago">ver ▸</div></div>';
    }).join('');
    el.querySelectorAll('.alerta[data-tab]').forEach(function(c){
      c.addEventListener('click',function(){
        var tab=c.getAttribute('data-tab'), drill=c.getAttribute('data-drill');
        var tb=document.querySelector('.tab[data-v="'+tab+'"]'); if(tb) tb.click();
        if(drill){ setTimeout(function(){ try{ abrir(drill); }catch(e){} }, 140); }
      });
    });
  }catch(e){ console.error('F3 alertas',e); }
})();

// ================================================================
// VENDAS — painel do vendedor (o que fazer hoje + esteira + cross-sell + equipe)
// ================================================================
window.renderVendas=function(){
  try{
    if(typeof F1==='undefined') return;
    var fila=(F1.fila_renov)||[], tcs=(F1.top_cs)||[], vend=(window.COM&&COM.vendedores)||[];
    var totVenc=0; fila.forEach(function(r){ totVenc+=(r.val||0); });
    var totCross=0; tcs.forEach(function(o){ totCross+=(o[2]||0); });
    var topR=fila[0]||{}, topC=tcs[0]||[];

    // Bloco 1 — o que fazer hoje
    var hoje=document.getElementById('v_hoje');
    if(hoje){ hoje.innerHTML=
      '<div class="card hero"><div class="label">A recuperar &middot; renovações vencidas</div>'
        +'<div class="val">'+brlC(totVenc)+'</div><div class="note">'+int(fila.length)+' renovações de maior valor, prontas pra cobrança.</div></div>'
      +'<div class="card kpi"><div class="label">Maior renovação parada</div><div class="val">'+brlC(topR.val||0)+'</div><div class="note">'+escH(topR.cli||'—')+'</div></div>'
      +'<div class="card kpi"><div class="label">Potencial de cross-sell</div><div class="val">'+brlC(totCross)+'</div><div class="note">'+int(tcs.length)+' clientes com lacunas pra oferecer.</div></div>'
      +'<div class="card kpi"><div class="label">Maior oportunidade</div><div class="val">'+brlC(topC[2]||0)+'</div><div class="note">'+escH(topC[0]||'—')+'</div></div>';
      // cards recriados a cada render não são observados pelo motion → garantir visíveis
      [].forEach.call(hoje.querySelectorAll('.card'),function(c){ c.classList.add('reveal'); });
    }

    // Bloco 2 — esteira (resumo por status + top 12)
    var STMAP={'Aberto':'aberto','Em contato':'contato','Renovado':'renovado','Perdido':'perdido'};
    var stats={'Aberto':{n:0,v:0},'Em contato':{n:0,v:0},'Renovado':{n:0,v:0},'Perdido':{n:0,v:0}};
    fila.forEach(function(r){ var t=(window.TASKS&&window.TASKS[r.k])||{}; var s=t.status||'Aberto'; if(!stats[s]) s='Aberto'; stats[s].n++; stats[s].v+=(r.val||0); });
    var rz=document.getElementById('v_resumo');
    if(rz){ var mp=[['Aberto','A cobrar','aberto'],['Em contato','Em contato','contato'],['Renovado','Renovado','renovado'],['Perdido','Perdido','perdido']];
      rz.innerHTML=mp.map(function(m){ var s=stats[m[0]];
        return '<div class="est-st '+m[2]+'"><div class="en">'+s.n+'</div><div class="el">'+escH(m[1])+'</div><div class="ev">'+brlF(s.v)+'</div></div>'; }).join('');
    }
    var estb=document.getElementById('v_esteira');
    if(estb){ estb.innerHTML=fila.slice(0,12).map(function(r){
      var t=(window.TASKS&&window.TASKS[r.k])||{}; var st=t.status||'Aberto'; var cls=STMAP[st]||'aberto';
      return '<tr><td class="cli">'+escH(r.cli)+'</td><td class="srv">'+escH(r.srv)+'</td>'
        +'<td><span class="tsk-dias">'+Math.abs(r.dias)+' d</span></td><td class="n">'+brlF(r.val)+'</td>'
        +'<td><span class="vbadge '+cls+'">'+escH(st)+'</span></td></tr>'; }).join('');
    }
    var ep=document.getElementById('v_est_pill'); if(ep) ep.textContent='as '+int(fila.length)+' de maior valor · '+brlC(totVenc)+' recuperáveis';

    // Bloco 3 — cross-sell (top 12)
    var cb=document.getElementById('v_cross');
    if(cb){ cb.innerHTML=tcs.slice(0,12).map(function(o){
      var gaps=String(o[1]||'').split(',').join(', ');
      return '<tr><td class="cli">'+escH(o[0])+'</td><td>'+escH(gaps)+'</td><td class="n">'+brlF(o[2]||0)+'</td></tr>'; }).join('');
    }
    var cp=document.getElementById('v_cross_pill'); if(cp) cp.textContent=int(tcs.length)+' clientes · '+brlC(totCross)+' em potencial';

    // Bloco 4 — desempenho da equipe (ranking por faturamento)
    var rk=document.getElementById('v_rank');
    if(rk){ var max=vend.reduce(function(m,v){ return Math.max(m,v[1]||0); },0)||1;
      rk.innerHTML=vend.map(function(v,i){ var w=Math.max(3,Math.round((v[1]||0)/max*100));
        return '<div class="vrank-row'+(i===0?' lead-row':'')+'"><div class="vn">'+escH(v[0])+'</div>'
          +'<div class="vrank-bar" style="width:'+w+'%"></div><div class="vv">'+brlC(v[1]||0)+'</div></div>'; }).join('');
    }

    // botões → abas completas
    var gr=document.getElementById('v_go_renov'); if(gr&&!gr.__w){ gr.__w=1; gr.addEventListener('click',function(){ var t=document.querySelector('.tab[data-v="renov"]'); if(t) t.click(); }); }
    var gc=document.getElementById('v_go_cross'); if(gc&&!gc.__w){ gc.__w=1; gc.addEventListener('click',function(){ var t=document.querySelector('.tab[data-v="cross"]'); if(t) t.click(); }); }
  }catch(e){ console.error('Vendas',e); }
};
window.renderVendas();
