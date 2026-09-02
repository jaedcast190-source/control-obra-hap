/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}

const DEDONDE = { plano:"Venía en plano", adicional:"Adicional en obra", comentario:"Comentario/indicación" };

let AVANCES = [], PROPUESTAS = [];

function getResponsable(a) {
  if (a.mundo === "interno") {
    return a.departamento || a.proveedor || "Interno HAP";
  }
  return a.proveedor || a.departamento || "Externo";
}

async function cargar() {
  const q = await (await fetch("/api/quien_soy")).json();
  if (!q.login) { location.href = "/login"; return; }
  if (q.rol !== "admin") { location.href = "/portal"; return; }
  const d = await (await fetch("/api/validacion/pendientes")).json();
  AVANCES = d.avances || [];
  PROPUESTAS = d.propuestas || [];
  renderAvances();
  renderPropuestas();
  await cargarAtencion();
}

async function cargarAtencion() {
  const d = await (await fetch("/api/validacion/atencion")).json();
  const nr = d.no_reconocidas || [];
  const re = d.rechazadas || [];
  $("#cont-aten").textContent = nr.length + re.length;
  
  // no reconocidas
  $("#vacio-noreco").hidden = nr.length > 0;
  $("#tbody-noreco").innerHTML = nr.map(a => `
    <tr>
      <td>${esc(getResponsable(a))}</td>
      <td class="mono">${esc(a.codigo||"")}</td>
      <td>${esc(a.bloque||"—")}</td>
      <td>${esc(a.area||"—")}</td>
      <td class="v-part">${esc(a.partida||"")}</td>
      <td class="v-coment">${esc(a.no_reconocida_nota||"")}</td>
      <td class="v-btns"><button class="v-ok2" data-id="${a.id}">Ya lo corregí</button></td>
    </tr>`).join("");
  $$("#tbody-noreco .v-ok2").forEach(b => b.onclick = async () => {
    await fetch("/api/validacion/limpiar_no_reconocida/" + b.dataset.id, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    toast("Marca quitada"); await cargar();
  });
  
  // rechazadas
  $("#vacio-rech").hidden = re.length > 0;
  $("#tbody-rech").innerHTML = re.map(a => `
    <tr>
      <td>${esc(getResponsable(a))}</td>
      <td class="mono">${esc(a.codigo||"")}</td>
      <td>${esc(a.bloque||"—")}</td>
      <td>${esc(a.area||"—")}</td>
      <td class="v-part">${esc(a.partida||"")}</td>
      <td class="v-coment">${esc(a.rechazo_motivo||"Rechazado por administración")}</td>
      <td class="v-btns"><button class="v-ok2" data-id="${a.id}">Reactivar</button></td>
    </tr>`).join("");
  $$("#tbody-rech .v-ok2").forEach(b => b.onclick = async () => {
    await fetch("/api/validacion/reactivar/" + b.dataset.id, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    toast("Reactivada — vuelve a propuestas"); await cargar();
  });
}

function renderAvances() {
  $("#cont-av").textContent = AVANCES.length;
  const tb = $("#tbody-av");
  $("#vacio-av").hidden = AVANCES.length > 0;
  $("#masa-av").hidden = AVANCES.length === 0;
  tb.innerHTML = AVANCES.map(a => `
    <tr data-id="${a.id}">
      <td><b>${esc(getResponsable(a))}</b></td>
      <td class="mono">${esc(a.codigo||"")}</td>
      <td>${esc(a.area||"")}</td>
      <td class="v-part">${esc(a.partida||"")}</td>
      <td class="v-cen">${a.avance||0}%</td>
      <td class="v-cen v-nuevo">${a.avance_decl}%</td>
      <td>${DEDONDE[a.definido_por]||"—"}</td>
      <td class="v-btns">
        <button class="v-ok" data-id="${a.id}">Firmar</button>
        <button class="v-no" data-id="${a.id}">Rechazar</button>
      </td>
    </tr>`).join("");
  enlazar();
}

function renderPropuestas() {
  $("#cont-prop").textContent = PROPUESTAS.length;
  const tb = $("#tbody-prop");
  $("#vacio-prop").hidden = PROPUESTAS.length > 0;
  tb.innerHTML = PROPUESTAS.map(a => {
    const fueraBadge = a.fuera_zona ? `<span class="badge-fuera-zona">⚠️ FUERA DE ZONA</span>` : "";
    const filaClase = a.fuera_zona ? `class="fila-fuera-zona"` : "";
    return `
    <tr data-id="${a.id}" ${filaClase}>
      <td><b>${esc(getResponsable(a))}</b> ${fueraBadge}</td>
      <td>${esc(a.bloque||"—")}</td>
      <td>${esc(a.area||"—")}</td>
      <td class="v-part">${esc(a.partida||"")}</td>
      <td class="v-cen">${a.avance_decl||0}%</td>
      <td>${DEDONDE[a.definido_por]||"—"}</td>
      <td class="v-coment">${esc(a.nota_proveedor||"")}</td>
      <td class="v-btns">
        <button class="v-ok" data-id="${a.id}">Aprobar</button>
        <button class="v-no" data-id="${a.id}">Rechazar</button>
      </td>
    </tr>`;
  }).join("");
  enlazar();
}

function enlazar() {
  $$(".v-ok").forEach(b => b.onclick = () => firmar(b.dataset.id));
  $$(".v-no").forEach(b => b.onclick = () => abrirModalRechazo(b.dataset.id));
}

async function firmar(id) {
  await fetch("/api/validacion/aprobar/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  toast("Firmado ✓");
  await cargar();
}

function abrirModalRechazo(id) {
  $("#rechazo-id").value = id;
  $("#rechazo-motivo").value = "";
  $("#modal-rechazo").hidden = false;
  setTimeout(() => $("#rechazo-motivo").focus(), 50);
}

function cerrarModalRechazo() {
  $("#modal-rechazo").hidden = true;
}

$("#btn-cerrar-rechazo").onclick = cerrarModalRechazo;
$("#btn-cancelar-rechazo").onclick = cerrarModalRechazo;
$("#btn-confirmar-rechazo").onclick = async () => {
  const id = $("#rechazo-id").value;
  const motivo = $("#rechazo-motivo").value.trim();
  cerrarModalRechazo();
  await fetch("/api/validacion/rechazar/" + id, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo: motivo || "Rechazado por administración" })
  });
  toast("Rechazado");
  await cargar();
};

$("#btn-todos-av").addEventListener("click", async () => {
  if (!AVANCES.length) return;
  if (!confirm(`¿Firmar los ${AVANCES.length} avances reportados? El avance oficial tomará los valores reportados.`)) return;
  await fetch("/api/validacion/aprobar_todas", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: AVANCES.map(a => a.id) }),
  });
  toast("Avances firmados");
  await cargar();
});

cargar();

