const $ = (s) => document.querySelector(s) || document.createElement("span");
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2600);}

let MUNDO = "obra";

function fmtFecha(iso){
  if(!iso) return "—";
  const d=new Date(iso+"T00:00:00");
  const m=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return d.getDate()+" "+m[d.getMonth()]+" "+d.getFullYear();
}
function clase(v){ return v>0.05 ? "mov-sube" : (v < -0.05 ? "mov-baja" : "mov-quieto"); }
function signo(v){ return (v>0?"+":"")+v.toFixed(1)+"%"; }

async function inicio(){
  const d = await (await fetch("/api/historico/fechas")).json();
  const hoy = d.hoy;
  $("#h-fecha").max = hoy;
  $("#c-hasta").max = hoy;
  $("#c-desde").max = hoy;
  $("#c-hasta").value = hoy;

  if (d.fotos && d.fotos.length){
    const vieja = d.fotos[d.fotos.length-1].fecha;
    $("#h-fecha").min = vieja;
    $("#c-desde").min = vieja;
    $("#h-fecha").value = d.fotos.length>1 ? d.fotos[1].fecha : vieja;
    $("#c-desde").value = vieja;
    $("#h-disponible").textContent =
      `Hay ${d.fotos.length} fotos guardadas, de ${fmtFecha(vieja)} a ${fmtFecha(d.fotos[0].fecha)}. `
      + `En fechas sin foto, el estado se reconstruye con el historial de cambios.`;
  } else {
    $("#h-disponible").innerHTML =
      "<b>Todavía no hay fotos guardadas.</b> El sistema empieza a guardar una foto por semana "
      + "de forma automática desde hoy. Mientras tanto, las fechas se reconstruyen con el historial de cambios.";
    $("#h-fecha").value = hoy;
    $("#c-desde").value = hoy;
  }
}

// ---- 1. Estado en una fecha ----
async function verFecha(){
  const f = $("#h-fecha").value;
  if(!f){ toast("Elige una fecha"); return; }
  const r = await (await fetch(`/api/historico?fecha=${f}&mundo=${MUNDO}`)).json();
  if (!r.total){ toast("No hay partidas en ese mundo"); $("#h-resultado").hidden = true; return; }

  const o = $("#h-origen");
  o.hidden = false;
  if (r.origen === "foto"){
    o.className = "h-origen foto";
    o.textContent = "📸 Desde la foto del " + fmtFecha(r.fecha_foto);
  } else {
    o.className = "h-origen reconstruido";
    o.textContent = "🔎 Reconstruido con el historial de cambios";
  }

  $("#k-entonces").textContent = r.avance_global + "%";
  $("#k-entonces-bar").style.width = r.avance_global + "%";
  $("#k-hoy").textContent = r.avance_hoy + "%";
  $("#k-hoy-bar").style.width = r.avance_hoy + "%";
  const dif = +(r.avance_hoy - r.avance_global).toFixed(1);
  $("#k-dif").textContent = signo(dif);
  $("#k-total").textContent = r.total;

  $("#tb-resp").innerHTML = r.responsables.map(x=>{
    const anchoA = Math.max(0,Math.min(100,x.avance));
    const anchoB = Math.max(0,Math.min(100,x.avance_hoy));
    return `<tr>
      <td>${esc(x.responsable)}</td><td>${x.total}</td>
      <td class="der">${x.avance}%</td>
      <td class="der"><b>${x.avance_hoy}%</b></td>
      <td class="der ${clase(x.cambio)}">${signo(x.cambio)}</td>
      <td><div class="barra-doble">
        <div class="ahora" style="width:${anchoB}%"></div>
        <div class="antes" style="width:${anchoA}%"></div></div></td>
    </tr>`;}).join("");

  $("#tb-bloque").innerHTML = r.bloques.map(b=>{
    const cls = b.avance>=75?"alto":b.avance<35?"bajo":"";
    return `<tr><td>${esc(b.bloque)}</td><td>${b.total}</td>
      <td class="der"><span class="pct">${b.avance}%</span></td>
      <td><div class="barra-mini"><div class="barra-mini-fill ${cls}" style="width:${b.avance}%"></div></div></td></tr>`;
  }).join("");

  const mov = r.detalle.filter(d=>Math.abs(d.cambio)>0).slice(0,40);
  $("#tb-detalle").innerHTML = mov.map(d=>`
    <tr><td class="cod">${esc(d.codigo||"")}</td><td>${esc(d.area||"—")}</td>
      <td class="partida-cell">${esc(d.partida||"")}</td><td>${esc(d.responsable)}</td>
      <td class="der">${d.avance_fecha}%</td><td class="der">${d.avance_hoy}%</td>
      <td class="der ${clase(d.cambio)}">${signo(d.cambio)}</td></tr>`).join("");
  $("#h-nota-detalle").textContent = mov.length
    ? `Se muestran las ${mov.length} partidas con mayor movimiento desde esa fecha.`
    : "Ninguna partida se ha movido desde esa fecha.";

  $("#h-resultado").hidden = false;
}

// ---- 2. Comparar dos fechas ----
async function comparar(){
  const d1 = $("#c-desde").value, d2 = $("#c-hasta").value;
  if(!d1 || !d2){ toast("Elige las dos fechas"); return; }
  if(d1 > d2){ toast("La primera fecha debe ser anterior"); return; }
  const r = await (await fetch(`/api/historico/comparar?desde=${d1}&hasta=${d2}&mundo=${MUNDO}`)).json();
  if (r.error){ toast(r.error); return; }
  if (!r.responsables){ toast("No hay datos para comparar"); return; }

  $("#c-resumen").innerHTML =
    `Del <b>${fmtFecha(r.desde)}</b> al <b>${fmtFecha(r.hasta)}</b> la obra pasó de `
    + `<b>${r.global_antes}%</b> a <b>${r.global_despues}%</b>: `
    + `<span class="${clase(r.global_cambio)}">${signo(r.global_cambio)}</span> en ese periodo.`;

  $("#tb-cresp").innerHTML = r.responsables.map(x=>`
    <tr><td>${esc(x.responsable)}</td><td>${x.total}</td>
      <td class="der">${x.antes}%</td><td class="der">${x.despues}%</td>
      <td class="der ${clase(x.cambio)}">${signo(x.cambio)}</td></tr>`).join("");

  $("#tb-cbloque").innerHTML = r.bloques.map(x=>`
    <tr><td>${esc(x.bloque)}</td><td>${x.total}</td>
      <td class="der">${x.antes}%</td><td class="der">${x.despues}%</td>
      <td class="der ${clase(x.cambio)}">${signo(x.cambio)}</td></tr>`).join("");

  $("#c-resultado").hidden = false;
}

// ---- interruptor de mundo ----
function ponerMundo(m){
  MUNDO = m;
  $("#h-obra").classList.toggle("activo", m==="obra");
  $("#h-interno").classList.toggle("activo", m==="interno");
  document.body.classList.toggle("mundo-interno", m==="interno");
  if (!$("#h-resultado").hidden) verFecha();
  if (!$("#c-resultado").hidden) comparar();
}

$("#btn-ver").addEventListener("click", verFecha);
$("#btn-comparar").addEventListener("click", comparar);
$("#h-obra").addEventListener("click", ()=>ponerMundo("obra"));
$("#h-interno").addEventListener("click", ()=>ponerMundo("interno"));
$("#h-fecha").addEventListener("change", ()=>{ if(!$("#h-resultado").hidden) verFecha(); });

inicio();
