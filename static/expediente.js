/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);
let FICHAS = [];

function escapa(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function cargar() {
  FICHAS = await (await fetch("/api/expediente")).json();
  render();
}

function render() {
  const q = ($("#buscar-prov").value || "").toLowerCase();
  const lista = FICHAS.filter((f) =>
    !q || f.nombre.toLowerCase().includes(q) || (f.empresa || "").toLowerCase().includes(q));
  const cont = $("#exp-lista");
  if (!lista.length) { cont.innerHTML = `<p class="vacio">Sin proveedores.</p>`; return; }
  cont.innerHTML = lista.map((f) => {
    const completa = f.empresa || f.contacto || f.telefono || f.correo;
    const tipoTag = f.tipo ? `<span class="exp-tipo ${f.tipo === 'Interno' ? 'ti' : 'te'}">${escapa(f.tipo)}</span>` : "";
    return `<div class="exp-card ${completa ? '' : 'exp-vacia'}" data-nombre="${escapa(f.nombre)}">
      <div class="exp-card-top">
        <b>${escapa(f.nombre)}</b>
        ${tipoTag}
      </div>
      <div class="exp-card-meta">
        <span>${f.partidas} partidas</span> · <span>${f.avance || 0}% avance</span>
      </div>
      ${f.empresa ? `<div class="exp-card-emp">${escapa(f.empresa)}</div>` : ""}
      ${f.contacto || f.telefono ? `<div class="exp-card-cont">${escapa(f.contacto || "")}${f.telefono ? " · " + escapa(f.telefono) : ""}</div>` : ""}
      ${!completa ? `<div class="exp-falta">Ficha sin llenar</div>` : ""}
    </div>`;
  }).join("");
  $$(".exp-card").forEach((c) =>
    c.addEventListener("click", () => abrirFicha(c.dataset.nombre)));
}

function abrirFicha(nombre) {
  const f = FICHAS.find((x) => x.nombre === nombre) || { nombre };
  $("#f-titulo").textContent = "Ficha · " + nombre;
  $("#f-nombre").value = nombre;
  $("#f-nombre-vis").value = nombre;
  $("#f-empresa").value = f.empresa || "";
  $("#f-tipo").value = f.tipo || "Externo";
  $("#f-funcion").value = f.funcion || "";
  $("#f-contacto").value = f.contacto || "";
  $("#f-telefono").value = f.telefono || "";
  $("#f-correo").value = f.correo || "";
  $("#f-notas").value = f.notas || "";
  $("#overlay-f").hidden = false; $("#overlay-f").style.display = "block";
  $("#panel-f").hidden = false; $("#panel-f").style.display = "flex";
}

function cerrarFicha() {
  $("#overlay-f").hidden = true; $("#overlay-f").style.display = "none";
  $("#panel-f").hidden = true; $("#panel-f").style.display = "none";
}

async function guardarFicha() {
  const cuerpo = {
    nombre: $("#f-nombre").value,
    empresa: $("#f-empresa").value, tipo: $("#f-tipo").value,
    funcion: $("#f-funcion").value, contacto: $("#f-contacto").value,
    telefono: $("#f-telefono").value, correo: $("#f-correo").value,
    notas: $("#f-notas").value,
  };
  await fetch("/api/expediente", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  cerrarFicha();
  toast("Ficha guardada");
  await cargar();
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  setTimeout(() => (t.hidden = true), 2000);
}

$("#buscar-prov").addEventListener("input", render);
$("#f-cerrar").addEventListener("click", cerrarFicha);
$("#f-cancelar").addEventListener("click", cerrarFicha);
$("#overlay-f").addEventListener("click", cerrarFicha);
$("#f-guardar").addEventListener("click", guardarFicha);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarFicha(); });

cerrarFicha();
cargar();
