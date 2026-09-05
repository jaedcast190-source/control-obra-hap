// ====== Estado ======
let TODAS = [];
let CATALOGOS = {};
let CAUSAS = [];
let SELECCION = new Set();
let MUNDO = "obra"; // 'obra' o 'interno'

/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);

// ====== Carga inicial ======
async function cargarTodo() {
  await cargarCatalogos();
  await cargarResumen();
  await cargarActividades();
  await cargarConteoValidacion();
}

async function cargarConteoValidacion() {
  try {
    const r = await (await fetch("/api/validacion/aviso_conteo")).json();
    const b = $("#badge-val");
    if (r.total > 0) { b.hidden = false; b.textContent = r.total; }
    else b.hidden = true;
  } catch (e) { /* silencio */ }
}

async function cargarCatalogos() {
  CATALOGOS = await (await fetch("/api/catalogos")).json();
  llenarDatalist("#dl-bloque", CATALOGOS.bloques);
  llenarDatalist("#dl-area", CATALOGOS.areas);
  llenarDatalist("#dl-proveedor", CATALOGOS.proveedores);
  llenarDatalist("#dl-giro", CATALOGOS.giros);
  llenarDatalist("#dl-tipo", CATALOGOS.tipos_partida);
  llenarDatalist("#dl-estatus", CATALOGOS.estatus);
  // datalists del panel de edición
  llenarDatalist("#dl-bloque-e", CATALOGOS.bloques);
  llenarDatalist("#dl-area-e", CATALOGOS.areas);
  llenarDatalist("#dl-giro-e", CATALOGOS.giros);
  llenarDatalist("#dl-proveedor-e", CATALOGOS.proveedores);
  await cargarCausas();
}

async function cargarCausas() {
  CAUSAS = await (await fetch("/api/causas?mundo=" + MUNDO)).json();
  llenarDatalist("#dl-causa", CAUSAS);
}

function llenarDatalist(sel, items) {
  $(sel).innerHTML = items.map((i) => `<option value="${escapa(i)}">`).join("");
}

// Reduce las opciones de área y proveedor según lo que ya esté filtrado
function refrescarListasDependientes() {
  const area = $("#f-area").value.trim();
  const prov = $("#f-proveedor").value.trim();
  const giro = $("#f-giro").value.trim();
  const bloque = $("#f-bloque").value.trim();
  const filtra = (a) =>
    (!bloque || a.bloque === bloque) &&
    (!area || a.area === area) &&
    (!prov || a.proveedor === prov) &&
    (!giro || a.giro === giro);
  // áreas disponibles dado proveedor/giro/bloque (sin fijar el propio área)
  const areasDisp = [...new Set(TODAS.filter((a) =>
    (!bloque || a.bloque === bloque) && (!prov || a.proveedor === prov) && (!giro || a.giro === giro)
  ).map((a) => a.area).filter(Boolean))].sort();
  const provDisp = [...new Set(TODAS.filter((a) =>
    (!bloque || a.bloque === bloque) && (!area || a.area === area) && (!giro || a.giro === giro)
  ).map((a) => a.proveedor).filter(Boolean))].sort();
  if (areasDisp.length) llenarDatalist("#dl-area", areasDisp);
  if (provDisp.length) llenarDatalist("#dl-proveedor", provDisp);
}

async function cargarResumen() {
  const r = await (await fetch("/api/resumen?mundo=" + MUNDO)).json();
  if (!r.total) return;
  $("#kpi-global").textContent = r.avance_global + "%";
  $("#kpi-global-bar").style.width = r.avance_global + "%";
  $("#kpi-total").textContent = r.total;
  $("#kpi-proceso").textContent = r.estatus["En proceso"] || 0;
  $("#kpi-listas").textContent = r.estatus["Listo"] || 0;
  $("#kpi-retraso").textContent = r.retrasadas.length;
  $("#kpi-riesgo").textContent = r.en_riesgo.length;

  const dias = r.dias_restantes;
  $("#dias-num").textContent = dias;
  if (dias <= 30) $("#contador").classList.add("critico");
}

async function cargarActividades() {
  const params = new URLSearchParams();
  params.set("mundo", MUNDO);
  if ($("#f-bloque").value) params.set("bloque", $("#f-bloque").value);
  if ($("#f-area").value) params.set("area", $("#f-area").value);
  if ($("#f-proveedor").value) params.set("proveedor", $("#f-proveedor").value);
  if ($("#f-giro").value) params.set("giro", $("#f-giro").value);
  if ($("#f-tipo-partida").value) params.set("tipo_partida", $("#f-tipo-partida").value);
  if ($("#f-estatus").value) params.set("estatus", $("#f-estatus").value);
  if ($("#buscar").value.trim()) params.set("buscar", $("#buscar").value.trim());
  TODAS = await (await fetch("/api/actividades?" + params)).json();
  render();
}

// ====== Render de la tabla, agrupada por bloque (desplegable) ======
function render() {
  const cont = $("#grupos-bloque");
  const hoy = new Date().toISOString().slice(0, 10);
  if (!TODAS.length) {
    cont.innerHTML = "";
    $("#vacio").hidden = false;
    return;
  }
  $("#vacio").hidden = true;

  // agrupar por bloque, respetando el orden en que aparecen
  const grupos = new Map();
  TODAS.forEach((a) => {
    const b = a.bloque || "— Sin bloque —";
    if (!grupos.has(b)) grupos.set(b, []);
    grupos.get(b).push(a);
  });

  cont.innerHTML = [...grupos.entries()].map(([bloque, acts]) => {
    const n = acts.length;
    const avgAv = Math.round(acts.reduce((s, a) => s + (a.avance || 0), 0) / n);
    const filas = acts.map((a) => filaHtml(a, hoy)).join("");
    return `<details class="grupo-bloque" data-bloque="${escapa(bloque)}">
      <summary class="grupo-resumen">
        <span class="grupo-nombre">${escapa(bloque)}</span>
        <span class="grupo-cant">${n} ${n === 1 ? "actividad" : "actividades"}</span>
        <span class="grupo-avance-barra"><span class="grupo-avance-fill" style="width:${avgAv}%"></span></span>
        <span class="grupo-avance-pct">${avgAv}%</span>
      </summary>
      <table>
        <thead><tr>
          <th class="col-check"></th>
          <th>Código</th><th>Área</th><th>Giro</th><th class="th-proveedor">Proveedor</th>
          <th>Partida</th><th>Tipo</th><th class="col-av">Avance</th>
          <th>Def.</th><th>Fin</th><th>Estatus</th><th></th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </details>`;
  }).join("");

  enlazarFilas();
}

function filaHtml(a, hoy) {
  const av = a.avance || 0;
  const full = av >= 100 ? "full" : "";
  const dep = a.depende_de ? nombreDep(a.depende_de) : "";
  let finCls = "";
  if (a.f_fin && av < 100) {
    if (a.f_fin < hoy) finCls = "fecha-tarde";
    else {
      const d = (new Date(a.f_fin) - new Date(hoy)) / 86400000;
      if (d <= 7) finCls = "fecha-cerca";
    }
  }
  const tp = a.tipo_partida || "Construcción";
  const tpCls = {"Construcción":"tp-con","Mobiliario y equipo":"tp-mob","Puesta en marcha":"tp-pm","Detalles finales":"tp-det"}[tp] || "tp-con";
  const def = (a.definido === "SÍ");
  const sel = SELECCION.has(a.id) ? "checked" : "";
  let depBadge = `<span style="color:#a0aec0;">—</span>`;
  if (a.dep_bloqueada) {
    depBadge = `<span title="${escapa(a.dep_detalle || '')}" style="cursor:help; background:#FEF3C7; color:#92400E; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">🔒 ${escapa(a.dep_estado || 'Bloqueada')}</span>`;
  } else if (a.dep_estado && a.dep_estado !== "Sin dependencias") {
    depBadge = `<span title="${escapa(a.dep_detalle || '')}" style="cursor:help; background:#D1FAE5; color:#065F46; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">🔓 ${escapa(a.dep_estado || 'Liberada')}</span>`;
  }
  return `<tr data-id="${a.id}">
      <td class="col-check"><input type="checkbox" class="chk-fila" data-id="${a.id}" ${sel}></td>
      <td class="cod">${escapa(a.codigo || "")}</td>
      <td>${escapa(a.area || "")}</td>
      <td><span class="giro-tag">${escapa(a.giro || "—")}</span></td>
      <td>${escapa((MUNDO === "interno" ? (a.departamento || a.proveedor) : a.proveedor) || "")}</td>
      <td class="partida-cell">${escapa(a.partida || "")}</td>
      <td><span class="tp-tag ${tpCls}">${escapa(tp)}</span></td>
      <td class="celda-avance" data-id="${a.id}">
        <div class="mini-barra"><div class="mini-barra-fill ${full}" style="width:${av}%"></div><span>${av}%</span></div>
        <select class="sel-avance" data-id="${a.id}">
          ${[0,25,50,75,100].map(v=>`<option value="${v}" ${v===av?"selected":""}>${v}%</option>`).join("")}
        </select>
      </td>
      <td class="col-def" data-id="${a.id}" title="¿Definido / tiene plano?">
        <span class="def-chip ${def?'def-si':'def-no'}">${def?'✓':'—'}</span>
      </td>
      <td class="col-dep" style="text-align:center;">${depBadge}</td>
      <td class="${finCls}">${escapa(a.f_fin || "")}</td>
      <td>${badge(a.estatus)}</td>
      <td class="acciones-fila">
        <span class="editar-ico" title="Editar">✎</span>
        <span class="hist-ico" data-id="${a.id}" title="Ver historial">🕑</span>
        <span class="borrar-ico" data-id="${a.id}" title="Eliminar">🗑</span>
      </td>
    </tr>`;
}

function enlazarFilas() {
  // clic en el renglón abre el panel, EXCEPTO sobre avance, definido, casilla o basura
  $$("#grupos-bloque tr[data-id]").forEach((tr) =>
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".celda-avance")) return;
      if (e.target.closest(".col-def")) return;
      if (e.target.closest(".col-dep")) return;
      if (e.target.closest(".col-check")) return;
      if (e.target.closest(".borrar-ico")) return;
      if (e.target.closest(".hist-ico")) return;
      abrirPanel(tr.dataset.id);
    })
  );
  // ícono de historial: abre la línea de tiempo de esa actividad
  $$(".hist-ico").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirHistorial(b.dataset.id, e);
    })
  );
  // cambio rápido de avance en línea
  $$(".sel-avance").forEach((sel) =>
    sel.addEventListener("change", async (e) => {
      e.stopPropagation();
      const id = sel.dataset.id;
      const av = parseInt(sel.value);
      await fetch("/api/actividad/" + id, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avance: av }),
      });
      toast("Avance actualizado a " + av + "%");
      await cargarResumen();
      await cargarActividades();
    })
  );
  // clic en el chip de "definido" lo alterna Sí/No directo en la tabla
  $$(".col-def").forEach((celda) =>
    celda.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = celda.dataset.id;
      const a = TODAS.find((x) => x.id == id);
      const nuevo = (a.definido === "SÍ") ? "NO" : "SÍ";
      await fetch("/api/actividad/" + id, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definido: nuevo }),
      });
      toast(nuevo === "SÍ" ? "Marcado como definido / en cancha" : "Desmarcado");
      await cargarActividades();
    })
  );
  // casillas de selección
  $$(".chk-fila").forEach((chk) =>
    chk.addEventListener("change", (e) => {
      e.stopPropagation();
      const id = parseInt(chk.dataset.id);
      if (chk.checked) SELECCION.add(id); else SELECCION.delete(id);
      actualizarBarraSeleccion();
    })
  );
  // botecito de basura: activa el modo selección y marca esta fila
  $$(".borrar-ico").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(b.dataset.id);
      activarModoSeleccion();
      SELECCION.add(id);
      actualizarBarraSeleccion();
      cargarActividades();
    })
  );
}

function nombreDep(id) {
  const a = TODAS.find((x) => x.id == id);
  return a ? (a.codigo + " · " + (a.partida || "").slice(0, 24)) : "#" + id;
}

function badge(est) {
  const m = { "Pendiente": "b-pendiente", "En proceso": "b-proceso", "Listo": "b-listo", "Post-apertura": "b-post" };
  return `<span class="badge ${m[est] || "b-pendiente"}">${escapa(est || "Pendiente")}</span>`;
}

function escapa(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ====== Panel de edición ======
function abrirPanel(id) {
  const a = TODAS.find((x) => x.id == id);
  if (!a) return;
  $("#panel-titulo").textContent = "Editar · " + (a.codigo || "actividad");
  $("#e-id").value = a.id;
  $("#e-bloque").value = a.bloque || "";
  filtrarAreasPorBloque();
  $("#e-area").value = a.area || "";
  $("#e-giro").value = a.giro || "";
  $("#e-proveedor").value = a.proveedor || "";
  $("#e-partida").value = a.partida || "";
  $("#e-tipo-partida").value = a.tipo_partida || "Construcción";
  $("#e-definido").value = a.definido || "NO";
  $("#e-aplica").value = a.aplica || "SÍ";
  $("#e-avance").value = a.avance || 0;
  $("#e-inicio").value = a.f_inicio || "";
  $("#e-fin").value = a.f_fin || "";
  $("#e-duracion").value = a.duracion_dias || "";
  $("#e-estatus").value = a.estatus || "Pendiente";
  $("#e-causa").value = a.causa_retraso || "";
  $("#e-nota-prov").value = a.nota_proveedor || "";
  const sello = $("#causa-sello");
  if (a.causa_por || a.causa_fecha) {
    sello.hidden = false;
    sello.textContent = `Causa registrada por ${a.causa_por || "—"}${a.causa_fecha ? " · " + a.causa_fecha : ""}`;
  } else {
    sello.hidden = true; sello.textContent = "";
  }
  $("#e-notas").value = a.notas || "";
  llenarDependencias(a.id, a.depende_de, a.bloque, a.area);
  $("#borrar-act").style.display = "inline-block";
  mostrarPanel();
}

function nuevaActividad() {
  $("#panel-titulo").textContent = "Nueva actividad";
  ["e-id", "e-area", "e-bloque", "e-giro", "e-proveedor", "e-partida", "e-inicio", "e-fin", "e-duracion", "e-notas", "e-causa", "e-nota-prov"]
    .forEach((i) => ($("#" + i).value = ""));
  $("#causa-sello").hidden = true;
  $("#e-aplica").value = "SÍ";
  $("#e-avance").value = 0;
  $("#e-tipo-partida").value = "Construcción";
  $("#e-definido").value = "NO";
  $("#e-estatus").value = "Pendiente";
  filtrarAreasPorBloque();
  llenarDependencias(null, null, "", "");
  $("#borrar-act").style.display = "none";
  mostrarPanel();
}

// al cambiar bloque o área en el formulario, recalcular las dependencias posibles
function recalcularDependencias() {
  const propioId = $("#e-id").value || null;
  const selActual = $("#e-depende").value || null;
  llenarDependencias(propioId, selActual, $("#e-bloque").value, $("#e-area").value);
}

// candado estricto: al elegir bloque, el área SOLO muestra las de ese bloque
function filtrarAreasPorBloque() {
  const bloque = $("#e-bloque").value;
  const mapa = (CATALOGOS.mapa_bloque_areas) || {};
  const areas = bloque && mapa[bloque] ? mapa[bloque] : [];
  llenarDatalist("#dl-area-e", areas);
  // si el área escrita no pertenece al bloque, se limpia (evita el error de mezclar zonas)
  const areaActual = $("#e-area").value;
  if (areaActual && bloque && !areas.includes(areaActual)) {
    $("#e-area").value = "";
  }
}

function llenarDependencias(propioId, seleccion, bloque, area) {
  const sel = $("#e-depende");
  // solo actividades del MISMO bloque y MISMA área (así el electricista solo ve lo de su zona)
  const mismas = TODAS.filter((a) =>
    a.id != propioId &&
    (a.bloque || "") === (bloque || "") &&
    (a.area || "") === (area || ""));
  const ops = mismas
    .map((a) => `<option value="${a.id}">${escapa(a.codigo)} · ${escapa((a.partida || "").slice(0, 45))}</option>`)
    .join("");
  sel.innerHTML = `<option value="">— Ninguna —</option>` + ops;
  if (seleccion) sel.value = seleccion;
}

function mostrarPanel() {
  const ov = $("#overlay"), pn = $("#panel");
  ov.hidden = false; pn.hidden = false;
  ov.style.display = "block";
  pn.style.display = "flex";
}
function ocultarPanel() {
  const ov = $("#overlay"), pn = $("#panel");
  ov.hidden = true; pn.hidden = true;
  ov.style.display = "none";
  pn.style.display = "none";
}

async function guardar() {
  const id = $("#e-id").value;
  const interno = MUNDO === "interno";
  const cuerpo = {
    area: $("#e-area").value, bloque: $("#e-bloque").value, giro: $("#e-giro").value,
    proveedor: $("#e-proveedor").value, partida: $("#e-partida").value,
    tipo_partida: $("#e-tipo-partida").value, definido: $("#e-definido").value,
    aplica: $("#e-aplica").value, avance: parseInt($("#e-avance").value || 0),
    f_inicio: $("#e-inicio").value || null, f_fin: $("#e-fin").value || null,
    duracion_dias: $("#e-duracion").value || null, estatus: $("#e-estatus").value,
    depende_de: $("#e-depende").value || null, notas: $("#e-notas").value,
    causa_retraso: $("#e-causa").value || null,
    nota_proveedor: $("#e-nota-prov").value || null,
    mundo: MUNDO,
  };
  // en interno, lo que se teclea en "proveedor" es el departamento; y el tipo va a tipo_interno
  if (interno) {
    cuerpo.departamento = $("#e-proveedor").value;
    cuerpo.tipo_interno = $("#e-tipo-partida").value;
  }
  let url = "/api/actividad", metodo = "POST";
  if (id) { url = "/api/actividad/" + id; metodo = "PUT"; }
  await fetch(url, {
    method: metodo, headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  ocultarPanel();
  toast(id ? "Actividad actualizada" : "Actividad creada");
  await cargarResumen();
  await cargarActividades();
}

async function borrar() {
  const id = $("#e-id").value;
  if (!id) return;
  if (!confirm("¿Eliminar esta actividad? No se puede deshacer.")) return;
  await fetch("/api/actividad/" + id, { method: "DELETE" });
  ocultarPanel();
  toast("Actividad eliminada");
  await cargarResumen();
  await cargarActividades();
}

// sincronizar avance <-> estatus en el panel
$("#e-avance").addEventListener("input", () => {
  const v = parseInt($("#e-avance").value || 0);
  if (v >= 100) $("#e-estatus").value = "Listo";
  else if (v > 0) $("#e-estatus").value = "En proceso";
  else $("#e-estatus").value = "Pendiente";
});

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  setTimeout(() => (t.hidden = true), 2200);
}

// ====== Eventos ======
["#f-bloque", "#f-area", "#f-proveedor", "#f-giro", "#f-tipo-partida", "#f-estatus"].forEach((s) =>
  $(s).addEventListener("change", () => { refrescarListasDependientes(); cargarActividades(); }));
// También filtra al escribir (con retraso), útil en área y proveedor
let debFiltro;
["#f-area", "#f-proveedor", "#f-giro", "#f-bloque", "#f-tipo-partida"].forEach((s) =>
  $(s).addEventListener("input", () => {
    clearTimeout(debFiltro);
    debFiltro = setTimeout(() => { refrescarListasDependientes(); cargarActividades(); }, 350);
  }));
let deb;
$("#buscar").addEventListener("input", () => {
  clearTimeout(deb); deb = setTimeout(cargarActividades, 250);
});
$("#btn-limpiar").addEventListener("click", () => {
  ["#f-bloque", "#f-area", "#f-proveedor", "#f-giro", "#f-tipo-partida", "#f-estatus"].forEach((s) => ($(s).value = ""));
  $("#buscar").value = "";
  llenarDatalist("#dl-area", CATALOGOS.areas);
  llenarDatalist("#dl-proveedor", CATALOGOS.proveedores);
  cargarActividades();
});
$("#btn-nueva").addEventListener("click", nuevaActividad);
// interruptor Obra / Internos
let TIPOS_INTERNOS = [];
async function adaptarInterfazMundo() {
  const interno = MUNDO === "interno";
  const palabra = interno ? "Departamento" : "Proveedor";
  // encabezado de la tabla
  $$(".th-proveedor").forEach((th) => (th.textContent = palabra));
  // label y filtro
  if ($("#lbl-proveedor")) $("#lbl-proveedor").textContent = palabra;
  if ($("#f-proveedor")) $("#f-proveedor").placeholder = palabra;
  if ($("#e-proveedor")) $("#e-proveedor").placeholder = interno ? "¿Qué departamento atiende?" : "";
  if ($("#btn-add-prov")) $("#btn-add-prov").textContent = interno ? "+ Agregar departamento" : "+ Agregar proveedor nuevo";
  if ($("#buscar")) $("#buscar").placeholder = interno ? "Buscar partida, área o departamento…" : "Buscar partida, área o proveedor…";
  // nota del proveedor -> del departamento
  if ($("#e-nota-prov")) $("#e-nota-prov").placeholder = interno
    ? "Aquí se anota lo que el departamento explica sobre el retraso"
    : "Aquí se anota lo que el proveedor explica sobre el retraso";
  const lblNota = document.querySelector('label[for="e-nota-prov"]') || null;
  // tipo de partida: obra usa los 4 mundos; interno usa los tipos internos editables
  const selTipo = $("#e-tipo-partida");
  if (selTipo) {
    if (interno) {
      if (!TIPOS_INTERNOS.length) {
        try { TIPOS_INTERNOS = await (await fetch("/api/tipos_internos")).json(); } catch(e){ TIPOS_INTERNOS = []; }
      }
      selTipo.innerHTML = TIPOS_INTERNOS.map(t => `<option>${t}</option>`).join("");
      if ($("#lbl-tipo-partida")) $("#lbl-tipo-partida").textContent = "Tipo de trabajo";
    } else {
      selTipo.innerHTML = `<option>Construcción</option><option>Mobiliario y equipo</option><option>Puesta en marcha</option><option>Detalles finales</option>`;
      if ($("#lbl-tipo-partida")) $("#lbl-tipo-partida").textContent = "Tipo de partida";
    }
  }
}

function cambiarMundo(m) {
  if (MUNDO === m) return;
  MUNDO = m;
  $("#sm-obra").classList.toggle("activo", m === "obra");
  $("#sm-interno").classList.toggle("activo", m === "interno");
  document.body.classList.toggle("mundo-interno", m === "interno");
  // limpiar filtros al cambiar de mundo
  ["#f-bloque", "#f-area", "#f-proveedor", "#f-giro", "#f-tipo-partida", "#f-estatus", "#buscar"].forEach(s => { if ($(s)) $(s).value = ""; });
  adaptarInterfazMundo();
  cargarTodo();
}
$("#sm-obra").addEventListener("click", () => cambiarMundo("obra"));
$("#sm-interno").addEventListener("click", () => cambiarMundo("interno"));
const histCerrar = $("#hist-cerrar");
if (histCerrar) histCerrar.addEventListener("click", cerrarHistorial);
const btnSalirAdmin = $("#btn-salir-admin");
if (btnSalirAdmin) btnSalirAdmin.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/login";
});
$("#btn-foto").addEventListener("click", async () => {
  if (!confirm("¿Cerrar el avance de esta semana? Se guarda cómo va la obra hoy, para poder comparar contra la próxima semana.")) return;
  const r = await (await fetch("/api/snapshot", { method: "POST" })).json();
  toast("Avance de la semana cerrado (" + r.partidas + " partidas) · " + r.semana);
});
$("#cerrar-panel").addEventListener("click", ocultarPanel);
$("#e-bloque").addEventListener("change", () => { filtrarAreasPorBloque(); recalcularDependencias(); });
$("#e-area").addEventListener("change", recalcularDependencias);
$("#e-bloque").addEventListener("input", () => { filtrarAreasPorBloque(); recalcularDependencias(); });
$("#e-area").addEventListener("input", recalcularDependencias);
$("#cancelar").addEventListener("click", ocultarPanel);
$("#overlay").addEventListener("click", ocultarPanel);
$("#guardar").addEventListener("click", guardar);
$("#borrar-act").addEventListener("click", borrar);
// Tecla Escape también cierra el panel
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") ocultarPanel();
});

// ====== Historial de una actividad ======
const NOMBRE_CAMPO = {
  "avance": "Avance oficial", "avance reportado": "Avance reportado",
  "avance validado": "Avance validado", "reconocimiento": "Reconocimiento",
  "no reconocida": "No reconocida", "actividad propuesta": "Actividad propuesta",
  "f_inicio": "Fecha inicio", "f_fin": "Fecha fin", "definido": "Definido/plano",
  "definido_por": "De dónde salió", "estatus": "Estatus", "proveedor": "Proveedor",
  "area": "Área", "bloque": "Bloque", "partida": "Partida", "giro": "Giro",
  "causa_retraso": "Causa de retraso", "nota_proveedor": "Nota del proveedor",
  "avance_decl": "Avance declarado",
};
async function abrirHistorial(id, ev) {
  const d = await (await fetch("/api/actividad/" + id + "/historial")).json();
  const cont = $("#hist-cuerpo");
  const a = d.actividad || {};
  $("#hist-titulo").textContent = (a.codigo || "") + " · " + (a.partida || "");
  $("#hist-sub").textContent = [a.bloque, a.area].filter(Boolean).join(" · ");
  if (!d.historial.length) {
    cont.innerHTML = `<p class="hist-vacio">Sin movimientos todavía. Aquí aparecerá cada cambio de avance, fecha o nota, con quién y cuándo lo hizo.</p>`;
  } else {
    cont.innerHTML = d.historial.map((h) => {
      const campo = NOMBRE_CAMPO[h.campo] || h.campo;
      const f = (h.fecha || "").replace("T", " ").slice(0, 16);
      const antes = h.valor_antes ? `<span class="hist-antes">${escapa(h.valor_antes)}</span> → ` : "";
      return `<div class="hist-item">
        <div class="hist-item-top"><b>${escapa(campo)}</b><span class="hist-fecha">${f}</span></div>
        <div class="hist-cambio">${antes}<span class="hist-despues">${escapa(h.valor_despues || "")}</span></div>
        <div class="hist-quien">${h.quien ? "por " + escapa(h.quien) : ""}</div>
      </div>`;
    }).join("");
  }
  const globo = $("#panel-hist");
  globo.hidden = false;
  globo.style.display = "block";
  // posicionar el globo junto al ícono que se clickeó
  if (ev) {
    const r = ev.target.getBoundingClientRect();
    const gw = 340;
    // por defecto a la izquierda del ícono (los íconos están a la derecha de la tabla)
    let left = r.left - gw - 10;
    if (left < 10) left = r.right + 10; // si no cabe, va a la derecha
    let top = r.top;
    globo.style.left = left + "px";
    globo.style.top = (window.scrollY + top) + "px";
    // si se sale por abajo, lo subo
    const gh = globo.offsetHeight;
    if (top + gh > window.innerHeight) {
      globo.style.top = (window.scrollY + Math.max(10, window.innerHeight - gh - 10)) + "px";
    }
  }
}
function cerrarHistorial() {
  const g = $("#panel-hist");
  g.hidden = true; g.style.display = "none";
}
// cerrar el globo al hacer clic fuera de él
document.addEventListener("click", (e) => {
  const g = $("#panel-hist");
  if (g && !g.hidden && !g.contains(e.target) && !e.target.closest(".hist-ico")) {
    cerrarHistorial();
  }
});
function activarModoSeleccion() {
  document.body.classList.add("modo-sel");
}
function salirModoSeleccion() {
  document.body.classList.remove("modo-sel");
  SELECCION.clear();
  const ct = $("#check-todos");
  if (ct) ct.checked = false;
}
function actualizarBarraSeleccion() {
  const n = SELECCION.size;
  const barra = $("#barra-seleccion");
  const enModo = document.body.classList.contains("modo-sel");
  // la barra solo se ve si estamos en modo selección Y hay algo marcado
  if (enModo && n > 0) {
    barra.hidden = false;
    $("#sel-conteo").textContent = n + (n === 1 ? " seleccionada" : " seleccionadas");
  } else {
    barra.hidden = true;
    // si ya no hay nada marcado, salimos del modo para no dejar casillas colgadas
    if (n === 0 && enModo) document.body.classList.remove("modo-sel");
  }
}

function pedirConfirmacionBorrado(ids) {
  IDS_A_BORRAR = ids;
  const lista = $("#del-lista");
  lista.innerHTML = ids.map((id) => {
    const a = TODAS.find((x) => x.id == id);
    if (!a) return "";
    return `<div class="del-item"><b>${escapa(a.codigo || "")}</b> · ${escapa(a.area || "")} · ${escapa(a.partida || "")}</div>`;
  }).join("");
  $("#del-titulo").textContent = ids.length === 1
    ? "Confirmar eliminación" : `Confirmar eliminación (${ids.length} partidas)`;
  $("#overlay-del").hidden = false; $("#overlay-del").style.display = "block";
  $("#modal-del").hidden = false; $("#modal-del").style.display = "flex";
}

function cerrarModalDel() {
  $("#overlay-del").hidden = true; $("#overlay-del").style.display = "none";
  $("#modal-del").hidden = true; $("#modal-del").style.display = "none";
}

async function ejecutarBorrado() {
  if (!IDS_A_BORRAR.length) return;
  if (IDS_A_BORRAR.length === 1) {
    await fetch("/api/actividad/" + IDS_A_BORRAR[0], { method: "DELETE" });
  } else {
    await fetch("/api/actividades/borrar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: IDS_A_BORRAR }),
    });
  }
  const n = IDS_A_BORRAR.length;
  IDS_A_BORRAR.forEach((id) => SELECCION.delete(id));
  IDS_A_BORRAR = [];
  cerrarModalDel();
  salirModoSeleccion();
  actualizarBarraSeleccion();
  toast(n === 1 ? "Partida eliminada" : n + " partidas eliminadas");
  await cargarResumen();
  await cargarActividades();
}

let IDS_A_BORRAR = [];
$("#btn-borrar-sel").addEventListener("click", () => {
  if (SELECCION.size === 0) { toast("No hay partidas seleccionadas"); return; }
  pedirConfirmacionBorrado([...SELECCION]);
});
$("#btn-deseleccionar").addEventListener("click", () => {
  salirModoSeleccion();
  actualizarBarraSeleccion();
  cargarActividades();
});
$("#check-todos").addEventListener("change", (e) => {
  if (e.target.checked) {
    TODAS.forEach((a) => SELECCION.add(a.id));
  } else {
    TODAS.forEach((a) => SELECCION.delete(a.id));
  }
  actualizarBarraSeleccion();
  cargarActividades();
});
$("#del-cerrar").addEventListener("click", cerrarModalDel);
$("#del-cancelar").addEventListener("click", cerrarModalDel);
$("#overlay-del").addEventListener("click", cerrarModalDel);
$("#del-confirmar").addEventListener("click", ejecutarBorrado);


let ADD_CLASE = null;
function abrirModalAdd(clase) {
  ADD_CLASE = clase;
  const titulos = { proveedor: "Agregar proveedor nuevo", area: "Agregar área nueva",
                    bloque: "Agregar bloque nuevo", giro: "Agregar giro nuevo",
                    causa: "Agregar causa de retraso" };
  $("#add-titulo").textContent = titulos[clase] || "Agregar";
  $("#add-nombre").value = "";
  $("#add-funcion").value = "";
  $("#add-tipo").value = "Externo";
  // el tipo Interno/Externo solo aplica a proveedor
  $("#add-tipo-wrap").style.display = (clase === "proveedor") ? "flex" : "none";
  // la causa solo necesita el nombre; ocultamos la descripción
  $("#add-funcion").parentElement.style.display = (clase === "causa") ? "none" : "block";
  $("#add-lbl-func").textContent = (clase === "proveedor")
    ? "¿De qué se encarga? (quién da el servicio o hace las actividades)"
    : "¿Para qué es? (breve nota)";
  $("#overlay-add").hidden = false; $("#overlay-add").style.display = "block";
  $("#modal-add").hidden = false; $("#modal-add").style.display = "flex";
  setTimeout(() => $("#add-nombre").focus(), 50);
}
function cerrarModalAdd() {
  $("#overlay-add").hidden = true; $("#overlay-add").style.display = "none";
  $("#modal-add").hidden = true; $("#modal-add").style.display = "none";
}
async function guardarModalAdd() {
  const nombre = $("#add-nombre").value.trim();
  if (!nombre) { toast("Escribe un nombre"); return; }
  if (ADD_CLASE === "proveedor") {
    await fetch("/api/proveedores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, tipo: $("#add-tipo").value, funcion: $("#add-funcion").value }),
    });
  } else if (ADD_CLASE === "causa") {
    await fetch("/api/causas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    await cargarCausas();
    $("#e-causa").value = nombre;
    cerrarModalAdd();
    toast("Causa agregada: " + nombre);
    return;
  } else {
    await fetch("/api/catalogo/" + ADD_CLASE, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, nota: $("#add-funcion").value }),
    });
  }
  // recargar catálogos y poner el valor recién creado en el campo del panel
  await cargarCatalogos();
  const destino = { proveedor: "#e-proveedor", area: "#e-area", bloque: "#e-bloque", giro: "#e-giro" }[ADD_CLASE];
  if (destino) $(destino).value = nombre;
  cerrarModalAdd();
  toast("Agregado: " + nombre);
}
$$(".mini-add").forEach((b) =>
  b.addEventListener("click", () => abrirModalAdd(b.dataset.add)));
$("#add-cerrar").addEventListener("click", cerrarModalAdd);
$("#add-cancelar").addEventListener("click", cerrarModalAdd);
$("#overlay-add").addEventListener("click", cerrarModalAdd);
$("#add-guardar").addEventListener("click", guardarModalAdd);

ocultarPanel();  // arrancar siempre con el panel cerrado
cerrarModalAdd();
cerrarModalDel();
cargarTodo();

// Botón X para limpiar los campos de captura del formulario
ponerBotonX("#e-bloque", () => {
  $("#e-area").value = "";
  filtrarAreasPorBloque();
  recalcularDependencias();
});
ponerBotonX("#e-area", () => recalcularDependencias());
ponerBotonX("#e-giro");
ponerBotonX("#e-proveedor");

// ============================================================================
// Administrador de Dependencias por Área
// ============================================================================
async function abrirModalDep() {
  $("#overlay-dep").hidden = false;
  $("#modal-dep").hidden = false;
  await cargarDependenciasModal();
}

function cerrarModalDep() {
  $("#overlay-dep").hidden = true;
  $("#modal-dep").hidden = true;
}

async function cargarDependenciasModal() {
  const deps = await (await fetch("/api/dependencias")).json();
  const tb = $("#tbody-dep-lista");
  $("#vacio-dep-lista").hidden = deps.length > 0;
  tb.innerHTML = deps.map(d => {
    const ev = d.evaluacion || {};
    const forzada = d.liberacion_forzada === 1;
    let stTag = `<span style="color:#1E7B4B; font-weight:600;">🔓 Liberada (${ev.avance_predecesores||0}%)</span>`;
    if (forzada) {
      stTag = `<span style="color:#B45309; font-weight:700;" title="Forzada por ${d.forzada_por}: ${d.forzada_nota}">⚡ Forzada</span>`;
    } else if (ev.bloqueada) {
      stTag = `<span style="color:#DC2626; font-weight:600;">🔒 Bloqueada (${ev.avance_predecesores||0}%)</span>`;
    }
    
    let btnForzar = "";
    if (forzada) {
      btnForzar = `<button class="btn-sec btn-sm btn-desforzar-dep" data-id="${d.id}" style="padding:3px 8px; font-size:11px;">Quitar forzado</button>`;
    } else {
      btnForzar = `<button class="btn-sec btn-sm btn-forzar-dep" data-id="${d.id}" style="padding:3px 8px; font-size:11px;">Forzar liberación</button>`;
    }

    return `
      <tr style="border-bottom:1px solid #edf2f7;">
        <td style="padding:6px 8px;"><b>${escapa(d.area)}</b></td>
        <td style="padding:6px 8px;">${escapa(d.tipo_sucesor)}</td>
        <td style="padding:6px 8px; color:#4a5568;">${escapa(d.tipos_predecesores)}</td>
        <td style="padding:6px 8px; text-align:center;">${d.umbral}%</td>
        <td style="padding:6px 8px;">${stTag}</td>
        <td style="padding:6px 8px; white-space:nowrap;">
          ${btnForzar}
          <button class="btn-borrar-sel btn-sm btn-borrar-dep" data-id="${d.id}" style="padding:3px 8px; font-size:11px; margin-left:4px;">🗑</button>
        </td>
      </tr>
    `;
  }).join("");

  $$(".btn-forzar-dep").forEach(b => b.onclick = async () => {
    const nota = prompt("Escribe una nota justificando la liberación anticipada:");
    if (!nota) return;
    await fetch(`/api/dependencias/${b.dataset.id}/forzar_liberacion`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota })
    });
    toast("Liberación anticipada autorizada");
    await cargarDependenciasModal();
    await cargarActividades();
  });

  $$(".btn-desforzar-dep").forEach(b => b.onclick = async () => {
    await fetch(`/api/dependencias/${b.dataset.id}/deshacer_forzar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    });
    toast("Liberación forzada revertida");
    await cargarDependenciasModal();
    await cargarActividades();
  });

  $$(".btn-borrar-dep").forEach(b => b.onclick = async () => {
    if (!confirm("¿Eliminar esta regla de dependencia?")) return;
    await fetch(`/api/dependencias/${b.dataset.id}`, { method: "DELETE" });
    toast("Regla eliminada");
    await cargarDependenciasModal();
    await cargarActividades();
  });
}

$("#btn-dep-mgr").onclick = abrirModalDep;
$("#dep-cerrar").onclick = cerrarModalDep;
$("#dep-cerrar-btn").onclick = cerrarModalDep;
$("#overlay-dep").onclick = cerrarModalDep;

$("#btn-crear-dep").onclick = async () => {
  const area = $("#dep-new-area").value.trim();
  const tipo_sucesor = $("#dep-new-sucesor").value.trim();
  const tipos_predecesores = $("#dep-new-predecesores").value.trim();
  const umbral = parseInt($("#dep-new-umbral").value || 100);

  if (!area || !tipos_predecesores) {
    toast("Ingresa el área y los predecesores");
    return;
  }

  const res = await (await fetch("/api/dependencias", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ area, tipo_sucesor, tipos_predecesores, umbral })
  })).json();

  if (res.ok) {
    toast("Regla de dependencia creada");
    $("#dep-new-area").value = "";
    $("#dep-new-predecesores").value = "";
    await cargarDependenciasModal();
    await cargarActividades();
  } else {
    toast(res.error || "Error al crear regla");
  }
};

// ============================================================================
// Respaldo Inmediato de Base de Datos
// ============================================================================
$("#btn-respaldo-rapido").onclick = async () => {
  toast("Generando respaldo de seguridad...");
  const res = await (await fetch("/api/respaldo", { method: "POST" })).json();
  if (res.ok) {
    toast(`Respaldo generado: ${res.archivo}`);
  } else {
    toast(res.error || "Error al generar respaldo");
  }
};

// ============================================================================
// Cambio de Contraseña de Administrador
// ============================================================================
function abrirClaveAdmin() {
  $("#admin-clave-actual").value = "";
  $("#admin-clave-nueva").value = "";
  $("#admin-clave-confirmar").value = "";
  $("#modal-clave-admin").hidden = false;
  setTimeout(() => $("#admin-clave-actual").focus(), 50);
}

function cerrarClaveAdmin() {
  $("#modal-clave-admin").hidden = true;
}

$("#btn-cambiar-clave-admin").onclick = abrirClaveAdmin;
$("#btn-cerrar-clave-admin").onclick = cerrarClaveAdmin;
$("#btn-cancelar-clave-admin").onclick = cerrarClaveAdmin;

$("#btn-guardar-clave-admin").onclick = async () => {
  const actual = $("#admin-clave-actual").value;
  const nueva = $("#admin-clave-nueva").value;
  const conf = $("#admin-clave-confirmar").value;
  if (!actual || !nueva) { toast("Llena los campos"); return; }
  if (nueva !== conf) { toast("La confirmación de contraseña no coincide"); return; }
  if (nueva.length < 4) { toast("La contraseña debe tener al menos 4 caracteres"); return; }

  const r = await (await fetch("/api/cambiar_mi_clave", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clave_actual: actual, clave_nueva: nueva })
  })).json();

  if (r.ok) {
    toast("Contraseña de administrador actualizada");
    cerrarClaveAdmin();
  } else {
    toast(r.error || "Error al actualizar contraseña");
  }
};
