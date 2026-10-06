/* Pantalla "Plano de obra" (admin edita; supervisor solo consulta) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let INFO = { existe: false, puede_editar: false, version: "0" };
  let VISOR = null;
  let PINES = [];
  let COLOCANDO = null;     // { actividad } cuando se está ubicando una actividad nueva
  let MOVIENDO = null;      // id del pin que se está reubicando
  let SEL = null;           // pin seleccionado
  let tBusca = null;

  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2600); }

  async function api(url, opc) {
    const r = await fetch(url, opc);
    if (r.status === 401) { location.href = "/login"; throw new Error("login"); }
    let d = {}; try { d = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok) throw new Error(d.error || ("Error " + r.status));
    return d;
  }

  async function inicio() {
    try {
      const q = await (await fetch("/api/quien_soy")).json();
      if (!q.login) { location.href = "/login"; return; }
      if (["admin", "supervisor", "supervisor_obra", "supervisor_depto"].indexOf(q.rol) < 0) { location.href = "/portal"; return; }
      INFO = await api("/api/plano/info");
    } catch (e) { return; }

    document.querySelectorAll(".perm-editar").forEach(el => { el.hidden = !INFO.puede_editar; });
    if (!INFO.puede_editar) {
      $("#tab-colocados").classList.add("on");
      $("#panel-colocados").hidden = false;
      $("#pl-sub").textContent = "Consulta del plano (solo lectura)";
    }

    VISOR = new PlanoVisor($("#pl-vista"), { onPin: abrirTarjeta, onVacio: alTocarVacio });
    if (!INFO.existe) { mostrarSinPlano(); }
    else { await VISOR.cargarImagen("/api/plano/imagen?v=" + encodeURIComponent(INFO.version)); }
    await cargarPines();
    if (INFO.puede_editar) buscarActividades();
  }

  function mostrarSinPlano() {
    $("#pl-vista").innerHTML = '<div class="pl-sinplano"><h2>Aún no hay plano cargado</h2>' +
      (INFO.puede_editar ? '<p>Sube el PDF o la imagen del plano con el botón <b>⬆ Subir / cambiar plano</b> de arriba.</p>' : '<p>El administrador todavía no sube el plano.</p>') + '</div>';
  }

  // ---------- subir plano ----------
  $("#btn-subir-plano").addEventListener("click", () => $("#file-plano").click());
  $("#file-plano").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (INFO.existe && PINES.length && !confirm("Ya hay un plano con " + PINES.length + " pines. Si subes otro, los pines se quedan en la misma posición relativa. ¿Reemplazar el plano?")) return;
    const fd = new FormData(); fd.append("archivo", f);
    toast("Subiendo y preparando el plano… puede tardar unos segundos");
    try {
      const r = await api("/api/plano/subir", { method: "POST", body: fd });
      INFO = await api("/api/plano/info");
      if (!$("#pl-vista .plano-lienzo")) { VISOR = new PlanoVisor($("#pl-vista"), { onPin: abrirTarjeta, onVacio: alTocarVacio }); }
      await VISOR.cargarImagen("/api/plano/imagen?v=" + encodeURIComponent(INFO.version));
      VISOR.setPines(PINES);
      toast("Plano cargado (" + r.kb + " KB)");
    } catch (err) { toast(err.message); }
  });

  // ---------- pestañas ----------
  function pestana(cual) {
    $("#tab-colocar").classList.toggle("on", cual === "colocar");
    $("#tab-colocados").classList.toggle("on", cual === "colocados");
    $("#panel-colocar").hidden = cual !== "colocar" || !INFO.puede_editar;
    $("#panel-colocados").hidden = cual !== "colocados";
  }
  $("#tab-colocar").addEventListener("click", () => pestana("colocar"));
  $("#tab-colocados").addEventListener("click", () => { pestana("colocados"); renderPines(); });

  // ---------- buscar actividades ----------
  async function buscarActividades() {
    const q = $("#pl-q").value.trim(), prov = $("#pl-prov").value;
    const solo = $("#pl-solo-sin").checked ? "1" : "0";
    try {
      const d = await api("/api/plano/actividades?q=" + encodeURIComponent(q) + "&proveedor=" + encodeURIComponent(prov) + "&solo_sin_pin=" + solo);
      if ($("#pl-prov").options.length <= 1) {
        $("#pl-prov").innerHTML = '<option value="">Todos los proveedores</option>' + d.proveedores.map(p => '<option>' + esc(p) + '</option>').join("");
      }
      $("#pl-resultados").innerHTML = d.actividades.length ? d.actividades.map(a =>
        '<button type="button" class="pl-item' + (COLOCANDO && COLOCANDO.id === a.id ? " activo" : "") + '" data-id="' + a.id + '">' +
        '<div class="i-cod">' + esc(a.codigo) + (a.n_pines ? '<span class="pl-badge">📍 ' + a.n_pines + '</span>' : '') + '</div>' +
        '<div class="i-par">' + esc(a.partida) + '</div>' +
        '<div class="i-met">' + esc([a.bloque, a.area, a.proveedor || a.departamento].filter(Boolean).join(" · ")) + ' · ' + (a.avance || 0) + '%</div></button>'
      ).join("") : '<p class="pl-sinplano" style="padding:16px">Sin resultados.</p>';
      $("#pl-resultados").dataset.lista = JSON.stringify(d.actividades);
    } catch (e) { toast(e.message); }
  }
  $("#pl-q").addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(buscarActividades, 250); });
  $("#pl-prov").addEventListener("change", buscarActividades);
  $("#pl-solo-sin").addEventListener("change", buscarActividades);
  $("#pl-resultados").addEventListener("click", (e) => {
    const b = e.target.closest(".pl-item"); if (!b) return;
    const lista = JSON.parse($("#pl-resultados").dataset.lista || "[]");
    const a = lista.find(x => x.id === Number(b.dataset.id));
    if (a) empezarColocar(a);
  });

  function empezarColocar(a) {
    if (!INFO.existe) { toast("Primero sube el plano."); return; }
    MOVIENDO = null; COLOCANDO = a;
    VISOR.setModoColocar(true);
    cerrarTarjeta();
    $("#pl-banner-txt").textContent = "Toca en el plano dónde va: " + a.codigo + " · " + (a.partida || "").slice(0, 60);
    $("#pl-banner").hidden = false;
    document.querySelectorAll(".pl-item").forEach(el => el.classList.toggle("activo", Number(el.dataset.id) === a.id));
  }
  function terminarModo() {
    COLOCANDO = null; MOVIENDO = null;
    if (VISOR) VISOR.setModoColocar(false);
    $("#pl-banner").hidden = true;
    document.querySelectorAll(".pl-item.activo").forEach(el => el.classList.remove("activo"));
  }
  $("#pl-banner-cancelar").addEventListener("click", terminarModo);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { terminarModo(); cerrarTarjeta(); } });

  async function alTocarVacio(f) {
    if (!INFO.puede_editar) { cerrarTarjeta(); return; }
    try {
      if (COLOCANDO) {
        const a = COLOCANDO;
        const r = await api("/api/plano/pines", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actividad_id: a.id, x: f.x, y: f.y }) });
        terminarModo();
        await cargarPines();
        VISOR.seleccionar(r.id);
        const pin = PINES.find(p => p.id === r.id);
        if (pin) abrirTarjeta(pin);
        toast("Pin colocado: " + a.codigo);
        buscarActividades();
      } else if (MOVIENDO) {
        const id = MOVIENDO;
        await api("/api/plano/pines/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: f.x, y: f.y }) });
        terminarModo();
        await cargarPines();
        VISOR.seleccionar(id);
        const pin = PINES.find(p => p.id === id);
        if (pin) abrirTarjeta(pin);
        toast("Pin movido");
      } else { cerrarTarjeta(); }
    } catch (err) { toast(err.message); }
  }

  // ---------- pines ----------
  async function cargarPines() {
    PINES = await api("/api/plano/pines");
    $("#n-colocados").textContent = PINES.length;
    if (VISOR) VISOR.setPines(PINES);
    renderPines();
  }

  function renderPines() {
    const q = ($("#pl-qc").value || "").trim().toLowerCase();
    const lista = PINES.filter(p => !q || [p.codigo, p.partida, p.area, p.bloque, p.proveedor, p.departamento].join(" ").toLowerCase().indexOf(q) >= 0);
    $("#pl-pines").innerHTML = lista.length ? lista.map(p =>
      '<button type="button" class="pl-item' + (SEL === p.id ? " activo" : "") + '" data-pin="' + p.id + '">' +
      '<div class="i-cod">' + esc(p.codigo) + ' · ' + (p.avance || 0) + '%</div>' +
      '<div class="i-par">' + esc(p.partida) + '</div>' +
      '<div class="i-met">' + esc([p.bloque, p.area, p.proveedor || p.departamento].filter(Boolean).join(" · ")) + '</div></button>'
    ).join("") : '<p class="pl-sinplano" style="padding:16px">Aún no hay pines.</p>';
  }
  $("#pl-qc").addEventListener("input", renderPines);
  $("#pl-pines").addEventListener("click", (e) => {
    const b = e.target.closest(".pl-item"); if (!b) return;
    const pin = PINES.find(p => p.id === Number(b.dataset.pin));
    if (!pin) return;
    VISOR.seleccionar(pin.id, true);
    abrirTarjeta(pin);
  });

  // ---------- tarjeta del pin ----------
  function abrirTarjeta(pin) {
    SEL = pin.id;
    const av = Number(pin.avance) || 0;
    const color = PlanoColorAvance(av);
    const enRev = pin.avance_decl != null && pin.avance_decl !== pin.avance;
    const t = $("#pl-tarjeta");
    t.style.setProperty("--c", color);
    t.innerHTML =
      '<button class="pt-cerrar" type="button" id="pt-x" title="Cerrar">✕</button>' +
      '<div class="pt-cod">' + esc(pin.codigo) + '</div>' +
      '<div class="pt-partida">' + esc(pin.partida) + '</div>' +
      '<div class="pt-meta">' + esc([pin.bloque, pin.area, pin.proveedor || pin.departamento].filter(Boolean).join(" · ")) + '</div>' +
      '<div class="pt-avance"><div class="pt-barra"><div style="width:' + av + '%"></div></div><span class="pt-pct">' + av + '%</span></div>' +
      (enRev ? '<div class="pt-rev">Reportado por el proveedor: ' + pin.avance_decl + '% · en revisión</div>' : '') +
      (INFO.puede_editar
        ? '<input class="pl-nota-in" id="pt-nota" maxlength="300" placeholder="Nota para el proveedor (opcional)" value="' + esc(pin.nota) + '">' +
          '<div class="pt-acciones"><button type="button" id="pt-guardar-nota" class="pt-pri">Guardar nota</button>' +
          '<button type="button" id="pt-mover">Mover</button><button type="button" id="pt-borrar" class="pt-peligro">Quitar pin</button></div>'
        : (pin.nota ? '<div class="pt-nota">' + esc(pin.nota) + '</div>' : ''));
    t.hidden = false;
    $("#pt-x").onclick = cerrarTarjeta;
    if (INFO.puede_editar) {
      $("#pt-guardar-nota").onclick = async () => {
        try { await api("/api/plano/pines/" + pin.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota: $("#pt-nota").value }) });
          pin.nota = $("#pt-nota").value; toast("Nota guardada"); } catch (e) { toast(e.message); }
      };
      $("#pt-mover").onclick = () => {
        COLOCANDO = null; MOVIENDO = pin.id; VISOR.setModoColocar(true); cerrarTarjeta(true);
        $("#pl-banner-txt").textContent = "Toca el nuevo lugar de " + pin.codigo;
        $("#pl-banner").hidden = false;
      };
      $("#pt-borrar").onclick = async () => {
        if (!confirm("¿Quitar este pin del plano? La actividad NO se borra.")) return;
        try { await api("/api/plano/pines/" + pin.id, { method: "DELETE" }); cerrarTarjeta(); await cargarPines(); toast("Pin quitado"); buscarActividades(); } catch (e) { toast(e.message); }
      };
    }
    renderPines();
  }
  function cerrarTarjeta(conservarSel) {
    $("#pl-tarjeta").hidden = true;
    if (!conservarSel) { SEL = null; if (VISOR) VISOR.seleccionar(null); renderPines(); }
  }

  inicio();
})();
