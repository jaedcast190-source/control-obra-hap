function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function fmtFecha(iso){
  if(!iso)return"—";
  const d=new Date(iso+"T00:00:00");
  const m=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return d.getDate()+" "+m[d.getMonth()]+" "+d.getFullYear();
}

async function cargar(){
  const r=await(await fetch("/api/resumen")).json();
  document.getElementById("rep-hoy").textContent=fmtFecha(r.fecha_hoy);
  document.getElementById("ra-global").textContent=r.avance_global+"%";
  document.getElementById("ra-barra").style.width=r.avance_global+"%";
  document.getElementById("ra-dias").textContent=r.dias_restantes;
  document.getElementById("ra-listas").textContent=r.estatus["Listo"]||0;
  document.getElementById("ra-retraso").textContent=r.retrasadas.length;

  // tipos de trabajo
  if (r.tipos) {
    document.getElementById("tbody-tipos").innerHTML=r.tipos.map(t=>{
      const cls=t.avance>=75?"alto":t.avance<35?"bajo":"";
      return `<tr><td>${esc(t.tipo)}</td><td>${t.total}</td>
        <td class="der"><span class="pct">${t.avance}%</span></td>
        <td><div class="barra-mini"><div class="barra-mini-fill ${cls}" style="width:${t.avance}%"></div></div></td></tr>`;
    }).join("");
  }

  // bloques
  document.getElementById("tbody-bloques").innerHTML=r.bloques.map(b=>{
    const cls=b.avance>=75?"alto":b.avance<35?"bajo":"";
    return `<tr><td>${esc(b.bloque)}</td><td>${b.total}</td>
      <td class="der"><span class="pct">${b.avance}%</span></td>
      <td><div class="barra-mini"><div class="barra-mini-fill ${cls}" style="width:${b.avance}%"></div></div></td></tr>`;
  }).join("");

  // giros
  document.getElementById("tbody-giros").innerHTML=r.giros.map(g=>{
    const cls=g.avance>=75?"alto":g.avance<35?"bajo":"";
    return `<tr><td>${esc(g.giro)}</td><td>${g.total}</td>
      <td class="der"><span class="pct">${g.avance}%</span></td>
      <td><div class="barra-mini"><div class="barra-mini-fill ${cls}" style="width:${g.avance}%"></div></div></td></tr>`;
  }).join("");

  // retrasadas
  const cntR=document.getElementById("cnt-retraso");
  if(r.retrasadas.length){
    cntR.textContent=r.retrasadas.length;
    document.getElementById("tbody-retraso").innerHTML=r.retrasadas.map(a=>
      `<tr><td>${esc(a.area)}</td><td>${esc(a.partida)}</td><td>${esc(a.proveedor||"—")}</td>
       <td>${fmtFecha(a.f_fin)}</td><td class="der dias-neg">${a.dias}</td>
       <td class="der">${a.avance}%</td></tr>`).join("");
  }else{
    cntR.style.display="none";
    document.getElementById("tabla-retraso").style.display="none";
    document.getElementById("vacio-retraso").hidden=false;
  }

  // en riesgo
  const cntG=document.getElementById("cnt-riesgo");
  if(r.en_riesgo.length){
    cntG.textContent=r.en_riesgo.length;
    document.getElementById("tbody-riesgo").innerHTML=r.en_riesgo.map(a=>
      `<tr><td>${esc(a.area)}</td><td>${esc(a.partida)}</td><td>${esc(a.proveedor||"—")}</td>
       <td>${fmtFecha(a.f_fin)}</td><td class="der dias-cerca">${a.dias}</td>
       <td class="der">${a.avance}%</td></tr>`).join("");
  }else{
    cntG.style.display="none";
    document.getElementById("tabla-riesgo").style.display="none";
    document.getElementById("vacio-riesgo").hidden=false;
  }
}
cargar();
