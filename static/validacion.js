/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}

const DEDONDE = { plano:"Venía en plano", adicional:"Adicional en obra", comentario:"Comentario/indicación" };

let AVANCES = [], PROPUESTAS = [], NORECO = [], RECHAZADAS = [];
let CATALOGOS = {}, CAUSAS_OBRA = [], CAUSAS_INTERNO = [];

function llenarDatalist(sel, items){ $(sel).innerHTML = (items||[]).map(i=>`<option value="${esc(i)}">`).join(""); }

async function cargarCatalogosEdicion(){
  CATALOGOS = await (await fetch("/api/catalogos")).json();
  llenarDatalist("#dl-ed-bloque", CATALOGOS.bloques);
  llenarDatalist("#dl-ed-giro", CATALOGOS.giros);
  CAUSAS_OBRA = await (await fetch("/api/causas?mundo=obra")).json();
  CAUSAS_INTERNO = await (await fetch("/api/causas?mundo=interno")).json();
}

function getResponsable(a) {
  if (a.mundo === "interno") {
    return a.departamento || a.proveedor || "Interno HAP";
  }
  return a.proveedor || a.departamento || "Externo";
}

async function cargar() {
  const q = await (await fetch("/api/quien_soy")).json();
  if (!q.login) { location.href = "/login"; return; }
  if (q.rol !== "admin" && q.rol !== "supervisor") { location.href = "/portal"; return; }
  if (!CATALOGOS.bloques) await cargarCatalogosEdicion();
  const d = await (await fetch("/api/validacion/pendientes")).json();
  AVANCES = d.avances || [];
  PROPUESTAS = d.propuestas || [];
  renderAvances();
  renderPropuestas();
  await cargarAtencion();
}

async function cargarAtencion() {
  const d = await (await fetch("/api/validacion/atencion")).json();
  NORECO = d.no_reconocidas || [];
  RECHAZADAS = d.rechazadas || [];
  $("#cont-aten").textContent = NORECO.length + RECHAZADAS.length;

  // no reconocidas
  $("#vacio-noreco").hidden = NORECO.length > 0;
  $("#tbody-noreco").innerHTML = NORECO.map(a => `
    <tr>
      <td>${esc(getResponsable(a))}</td>
      <td class="mono">${esc(a.codigo||"")}</td>
      <td>${esc(a.bloque||"—")}</td>
      <td>${esc(a.area||"—")}</td>
      <td class="v-part">${esc(a.partida||"")}</td>
      <td class="v-coment">${esc(a.no_reconocida_nota||"")}</td>
      <td class="v-btns">
        <button class="v-editar" data-acc="editar" data-ctx="noreco" data-id="${a.id}">✎ Editar</button>
        <button class="v-ok2" data-id="${a.id}">Ya lo corregí</button>
      </td>
    </tr>`).join("");
  $$("#tbody-noreco .v-ok2").forEach(b => b.onclick = async () => {
    await fetch("/api/validacion/limpiar_no_reconocida/" + b.dataset.id, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    toast("Marca quitada"); await cargar();
  });
  $$('#tbody-noreco [data-acc="editar"]').forEach(b => b.onclick = () => abrirEditar(b.dataset.id, "noreco", NORECO));

  // rechazadas
  $("#vacio-rech").hidden = RECHAZADAS.length > 0;
  $("#tbody-rech").innerHTML = RECHAZADAS.map(a => `
    <tr>
      <td>${esc(getResponsable(a))}</td>
      <td class="mono">${esc(a.codigo||"")}</td>
      <td>${esc(a.bloque||"—")}</td>
      <td>${esc(a.area||"—")}</td>
      <td class="v-part">${esc(a.partida||"")}</td>
      <td class="v-coment">${esc(a.rechazo_motivo||"Rechazado por administración")}</td>
      <td class="v-btns">
        <button class="v-editar" data-acc="editar" data-ctx="rechazada" data-id="${a.id}">✎ Editar</button>
        <button class="v-ok2" data-id="${a.id}">Reactivar</button>
      </td>
    </tr>`).join("");
  $$("#tbody-rech .v-ok2").forEach(b => b.onclick = async () => {
    await fetch("/api/validacion/reactivar/" + b.dataset.id, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    toast("Reactivada — vuelve a propuestas"); await cargar();
  });
  $$('#tbody-rech [data-acc="editar"]').forEach(b => b.onclick = () => abrirEditar(b.dataset.id, "rechazada", RECHAZADAS));
}

/* ---------- editar y corregir (todos los campos, igual que el panel) ---------- */
function llenarProveedorSegunMundo(mundo){
  const lista = mundo === "interno" ? (CATALOGOS.departamentos||[]) : (CATALOGOS.proveedores||[]);
  llenarDatalist("#dl-ed-proveedor", lista);
  $("#ed-lbl-prov").textContent = mundo === "interno" ? "Departamento" : "Proveedor";
}
function llenarAreasSegunBloque(){
  const bloque = $("#ed-bloque").value;
  const mapa = CATALOGOS.mapa_bloque_areas || {};
  const areas = bloque && mapa[bloque] ? mapa[bloque] : (CATALOGOS.areas||[]);
  llenarDatalist("#dl-ed-area", areas);
}
async function llenarDependenciasEd(propioId, seleccion, bloque, area){
  const sel = $("#ed-depende");
  if (!bloque && !area) { sel.innerHTML = '<option value="">— Ninguna —</option>'; return; }
  const params = new URLSearchParams();
  if (bloque) params.set("bloque", bloque);
  if (area) params.set("area", area);
  params.set("mundo", "todos");
  const lista = await (await fetch("/api/actividades?" + params.toString())).json();
  const ops = lista.filter(a => a.id != propioId)
    .map(a => `<option value="${a.id}">${esc(a.codigo)} · ${esc((a.partida||"").slice(0,45))}</option>`).join("");
  sel.innerHTML = '<option value="">— Ninguna —</option>' + ops;
  if (seleccion) sel.value = seleccion;
}

function abrirEditar(id, contexto, lista) {
  const a = lista.find(x => String(x.id) === String(id));
  if (!a) return;
  const mundo = a.mundo || "obra";
  $("#ed-id").value = id;
  $("#ed-contexto").value = contexto;
  $("#ed-mundo").value = mundo;
  $("#ed-codigo").textContent = a.codigo || "";
  llenarProveedorSegunMundo(mundo);
  llenarDatalist("#dl-ed-causa", mundo === "interno" ? CAUSAS_INTERNO : CAUSAS_OBRA);
  $("#ed-bloque").value = a.bloque || "";
  llenarAreasSegunBloque();
  $("#ed-area").value = a.area || "";
  $("#ed-giro").value = a.giro || "";
  $("#ed-proveedor").value = (mundo === "interno" ? a.departamento : a.proveedor) || "";
  $("#ed-partida").value = a.partida || "";
  $("#ed-tipo-partida").value = a.tipo_partida || "Construcción";
  $("#ed-definido").value = a.definido || "NO";
  $("#ed-aplica").value = a.aplica || "SÍ";
  $("#ed-avance").value = a.avance || 0;
  $("#ed-inicio").value = a.f_inicio || "";
  $("#ed-fin").value = a.f_fin || "";
  $("#ed-duracion").value = a.duracion_dias || "";
  $("#ed-estatus").value = a.estatus || "Pendiente";
  $("#ed-causa").value = a.causa_retraso || "";
  $("#ed-nota-prov").value = a.nota_proveedor || "";
  $("#ed-notas").value = a.notas || "";
  llenarDependenciasEd(a.id, a.depende_de, a.bloque, a.area);
  $("#ed-titulo").textContent = contexto === "noreco" ? "Corregir y quitar marca" : "Corregir y reactivar";
  $("#btn-guardar-editar").textContent = contexto === "noreco" ? "Guardar y quitar marca" : "Guardar y reactivar";
  mostrarEditar();
}
function mostrarEditar(){
  $("#overlay-ed").hidden = false; $("#overlay-ed").style.display = "block";
  $("#panel-editar").hidden = false; $("#panel-editar").style.display = "flex";
}
function cerrarEditar() {
  $("#overlay-ed").hidden = true; $("#overlay-ed").style.display = "none";
  $("#panel-editar").hidden = true; $("#panel-editar").style.display = "none";
}
$("#btn-cerrar-editar").onclick = cerrarEditar;
$("#btn-cancelar-editar").onclick = cerrarEditar;
$("#overlay-ed").onclick = cerrarEditar;

$("#ed-bloque").addEventListener("change", () => { llenarAreasSegunBloque(); llenarDependenciasEd($("#ed-id").value, $("#ed-depende").value, $("#ed-bloque").value, $("#ed-area").value); });
$("#ed-bloque").addEventListener("input", () => { llenarAreasSegunBloque(); });
$("#ed-area").addEventListener("change", () => llenarDependenciasEd($("#ed-id").value, $("#ed-depende").value, $("#ed-bloque").value, $("#ed-area").value));

// mini "+ agregar" rapido: usa el mismo catalogo generico del panel principal
$$('#panel-editar [data-add]').forEach(btn => {
  btn.onclick = async () => {
    const clase = btn.dataset.add;
    if (clase === "causa") {
      const nombre = (prompt("Nueva causa de retraso:") || "").trim();
      if (!nombre) return;
      const mundo = $("#ed-mundo").value;
      await fetch("/api/causas", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nombre, mundo }) });
      if (mundo === "interno") CAUSAS_INTERNO.push(nombre); else CAUSAS_OBRA.push(nombre);
      llenarDatalist("#dl-ed-causa", mundo === "interno" ? CAUSAS_INTERNO : CAUSAS_OBRA);
      $("#ed-causa").value = nombre;
      return;
    }
    if (clase === "proveedor") {
      const nombre = (prompt("Nombre del proveedor/departamento nuevo:") || "").trim();
      if (!nombre) return;
      await fetch("/api/expediente", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nombre, tipo: $("#ed-mundo").value === "interno" ? "Interno" : "Externo" }) });
      const mundo = $("#ed-mundo").value;
      if (mundo === "interno") CATALOGOS.departamentos = [...(CATALOGOS.departamentos||[]), nombre];
      else CATALOGOS.proveedores = [...(CATALOGOS.proveedores||[]), nombre];
      llenarProveedorSegunMundo(mundo);
      $("#ed-proveedor").value = nombre;
      return;
    }
    const nombre = (prompt(`Nuevo ${clase}:`) || "").trim();
    if (!nombre) return;
    await fetch("/api/catalogo/" + clase, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nombre }) });
    if (clase === "bloque") { CATALOGOS.bloques = [...(CATALOGOS.bloques||[]), nombre]; llenarDatalist("#dl-ed-bloque", CATALOGOS.bloques); $("#ed-bloque").value = nombre; llenarAreasSegunBloque(); }
    if (clase === "area") { CATALOGOS.areas = [...(CATALOGOS.areas||[]), nombre]; llenarAreasSegunBloque(); $("#ed-area").value = nombre; }
    if (clase === "giro") { CATALOGOS.giros = [...(CATALOGOS.giros||[]), nombre]; llenarDatalist("#dl-ed-giro", CATALOGOS.giros); $("#ed-giro").value = nombre; }
  };
});

$("#btn-guardar-editar").onclick = async () => {
  const id = $("#ed-id").value;
  const contexto = $("#ed-contexto").value;
  const mundo = $("#ed-mundo").value;
  const cuerpo = {
    area: $("#ed-area").value, bloque: $("#ed-bloque").value, giro: $("#ed-giro").value,
    partida: $("#ed-partida").value, tipo_partida: $("#ed-tipo-partida").value,
    definido: $("#ed-definido").value, aplica: $("#ed-aplica").value,
    avance: parseInt($("#ed-avance").value || 0),
    f_inicio: $("#ed-inicio").value || null, f_fin: $("#ed-fin").value || null,
    duracion_dias: $("#ed-duracion").value || null, estatus: $("#ed-estatus").value,
    depende_de: $("#ed-depende").value || null, notas: $("#ed-notas").value,
    causa_retraso: $("#ed-causa").value || null, nota_proveedor: $("#ed-nota-prov").value || null,
    mundo,
  };
  if (mundo === "interno") {
    cuerpo.departamento = $("#ed-proveedor").value;
    cuerpo.tipo_interno = $("#ed-tipo-partida").value;
  } else {
    cuerpo.proveedor = $("#ed-proveedor").value;
  }
  const r = await (await fetch("/api/actividad/" + id, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })).json();
  if (r.error) { toast(r.error); return; }
  cerrarEditar();
  if (contexto === "noreco") {
    await fetch("/api/validacion/limpiar_no_reconocida/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    toast("Corregida — vuelve como nueva para reconocer");
  } else {
    await fetch("/api/validacion/reactivar/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    toast("Corregida y reactivada");
  }
  await cargar();
};

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

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  cerrarModalRechazo(); cerrarEditar();
});

// Eliminar actividad desde el panel de editar de Validación
$("#btn-eliminar-editar").addEventListener("click", async () => {
  const id = $("#ed-id").value;
  const cod = $("#ed-codigo").textContent;
  if (!id) return;
  if (!confirm(`¿Eliminar la actividad ${cod}? Esta acción no se puede deshacer.`)) return;
  const r = await fetch("/api/actividad/" + id, { method: "DELETE" });
  if (r.ok) {
    cerrarEditar();
    toast("Actividad eliminada");
    await cargar();
  } else {
    toast("Error al eliminar");
  }
});

cargar();
