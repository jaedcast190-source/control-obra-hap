/* === BLINDAJE v1.4 — metodo seguro: si un id no existe, $ devuelve un
   elemento suelto en vez de null, para que el script nunca se muera. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);
let PROVS = [];

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}

function rolTag(u){
  if (u.rol === "admin") return '<span class="u-roltag u-rol-admin">Administrador</span>';
  if (u.rol === "supervisor_obra") return '<span class="u-roltag u-rol-super">Superv. Obra</span>';
  if (u.rol === "supervisor_depto") return '<span class="u-roltag u-rol-super">Superv. Depto</span>';
  return '<span class="u-roltag u-rol-prov">Proveedor</span>';
}

/* ---------- sección 1: accesos generales (admin/supervisores) ---------- */
async function cargarGenerales(){
  const us = await (await fetch("/api/usuarios")).json();
  const generales = us.filter(u => u.rol === "admin" || u.rol === "supervisor_obra" || u.rol === "supervisor_depto");
  $("#tbody-generales").innerHTML = generales.map(u => {
    const activo = (u.activo===undefined||u.activo===null) ? 1 : u.activo;
    const esAdmin = u.rol === "admin";
    const ult = u.ultimo_login ? (" · último " + esc(String(u.ultimo_login).slice(0,10))) : "";
    return `<tr>
      <td class="mono">${esc(u.usuario)}</td>
      <td>${u.mundo==="interno"?'<span class="exp-tipo ti">Interno</span>':'<span class="exp-tipo te">Externo</span>'}</td>
      <td>${rolTag(u)}</td>
      <td class="u-logins">${(u.num_logins||0)} ${(u.num_logins===1?'vez':'veces')}${ult}</td>
      <td>${esAdmin ? '<span class="u-estado u-activo">Activo</span>'
                    : `<span class="u-estado ${activo?'u-activo':'u-inactivo'}">${activo?'Activo':'Inactivo'}</span>`}</td>
      <td class="v-btns">
        ${esAdmin ? "" : `
          <button class="u-btn-mini" data-acc="reset" data-id="${u.id}" data-nom="${esc(u.usuario)}">🔑 Contraseña</button>
          <button class="u-btn-mini" data-acc="toggleuser" data-id="${u.id}" data-activo="${activo}">${activo?'Desactivar':'Activar'}</button>
          <button class="v-no" data-acc="del" data-id="${u.id}">Quitar</button>
        `}
      </td>
    </tr>`;
  }).join("");
  enlazarBotonesGenerales();
}

function enlazarBotonesGenerales(){
  $$("#tbody-generales [data-acc]").forEach(b => {
    const acc = b.dataset.acc, id = b.dataset.id;
    b.onclick = async () => {
      if (acc === "del") {
        if (!confirm("¿Quitar este acceso?")) return;
        await fetch("/api/usuario/" + id, { method: "DELETE" });
        toast("Acceso eliminado"); cargarTodo();
      } else if (acc === "toggleuser") {
        const activo = b.dataset.activo === "1";
        await fetch("/api/usuario/" + id + "/activo", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ activo: !activo }) });
        toast(activo ? "Acceso desactivado" : "Acceso activado"); cargarTodo();
      } else if (acc === "reset") {
        abrirReset(id, b.dataset.nom);
      }
    };
  });
}

/* ---------- sección 2: proveedores + su acceso, unificado ---------- */
async function cargarProveedores(){
  PROVS = await (await fetch("/api/proveedores_usuarios")).json();
  $("#dl-nuevo-prov").innerHTML = PROVS.map(p=>`<option value="${esc(p.nombre)}">`).join("");
  render();
}

function render(){
  const q = ($("#buscar-prov").value || "").toLowerCase();
  const lista = PROVS.filter(p => !q || p.nombre.toLowerCase().includes(q) || (p.empresa||"").toLowerCase().includes(q));
  const cont = $("#lista-proveedores");
  if (!lista.length){ cont.innerHTML = `<p class="vacio">Sin proveedores todavía.</p>`; return; }
  cont.innerHTML = lista.map(p => {
    const tipoTag = `<span class="exp-tipo ${p.tipo==='Interno'?'ti':'te'}">${esc(p.tipo)}</span>`;
    const fichaLlena = p.empresa || p.contacto || p.telefono || p.correo;
    const fichaTxt = fichaLlena
      ? `${esc(p.empresa||p.nombre)}${p.contacto?' · '+esc(p.contacto):''}${p.telefono?' · '+esc(p.telefono):''}`
      : `<span class="falta">Ficha sin llenar</span>`;
    const accesos = p.usuarios.map(u => {
      const activo = (u.activo===undefined||u.activo===null) ? 1 : u.activo;
      const ult = u.ultimo_login ? (" · último " + esc(String(u.ultimo_login).slice(0,10))) : "";
      return `<div class="u-acceso-fila">
        <span class="mono">${esc(u.usuario)}</span>
        <span class="u-estado ${activo?'u-activo':'u-inactivo'}">${activo?'Activo':'Inactivo'}</span>
        <span class="u-logins">${(u.num_logins||0)} ${(u.num_logins===1?'vez':'veces')}${ult}</span>
        <button class="u-btn-mini" data-acc="reset" data-id="${u.id}" data-nom="${esc(u.usuario)}">🔑 Contraseña</button>
        <button class="u-btn-mini" data-acc="tel" data-id="${u.id}" data-nom="${esc(u.usuario)}" data-tel="${esc(u.telefono||'')}">📞 Tel</button>
        ${u.mundo==='obra' ? `<button class="u-btnwa" data-acc="wa" data-id="${u.id}">WhatsApp</button>` : ""}
        <button class="u-btn-mini" data-acc="toggleuser" data-id="${u.id}" data-activo="${activo}">${activo?'Desactivar':'Activar'}</button>
        <button class="v-no" data-acc="del" data-id="${u.id}">Quitar</button>
      </div>`;
    }).join("");
    const mundoProv = p.tipo === "Interno" ? "interno" : "obra";
    const cajaAcceso = p.usuarios.length
      ? accesos
      : `<span class="u-sin-acceso">Sin acceso a la plataforma todavía.</span>
         <button class="u-btn-mini" data-acc="crear-acceso" data-nombre="${esc(p.nombre)}" data-mundo="${mundoProv}">+ Crear acceso</button>`;
    return `<div class="u-prov-card ${p.activo ? '' : 'inactivo'}" data-nombre="${esc(p.nombre)}">
      <div class="u-prov-top">
        <span class="u-prov-nombre">${esc(p.nombre)}</span>
        ${tipoTag}
        <span class="u-estado ${p.activo?'u-activo':'u-inactivo'}">${p.activo?'Activo':'Inactivo'}</span>
        <span class="flex" style="flex:1"></span>
        <button class="u-btn-mini" data-acc="editar-ficha" data-nombre="${esc(p.nombre)}">✎ Editar ficha</button>
        <button class="u-btn-mini" data-acc="toggleprov" data-nombre="${esc(p.nombre)}" data-activo="${p.activo}">${p.activo?'Desactivar proveedor':'Activar proveedor'}</button>
      </div>
      <div class="u-prov-meta">${p.partidas} partidas · ${p.avance||0}% avance</div>
      <div class="u-prov-ficha">${fichaTxt}</div>
      <div class="u-acceso-box">${cajaAcceso}</div>
    </div>`;
  }).join("");
  enlazarBotonesProveedores();
}

function enlazarBotonesProveedores(){
  $$("#lista-proveedores [data-acc]").forEach(b => {
    const acc = b.dataset.acc;
    b.onclick = async () => {
      if (acc === "editar-ficha") { abrirFicha(b.dataset.nombre); return; }
      if (acc === "toggleprov") {
        const activo = b.dataset.activo === "1";
        await fetch("/api/proveedores/" + encodeURIComponent(b.dataset.nombre) + "/activo", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ activo: !activo }) });
        toast(activo ? "Proveedor desactivado (su historial se conserva)" : "Proveedor activado");
        cargarProveedores();
        return;
      }
      if (acc === "crear-acceso") { abrirAcceso(b.dataset.nombre, b.dataset.mundo); return; }
      const id = b.dataset.id;
      if (acc === "del") {
        if (!confirm("¿Quitar este acceso? El proveedor y su historial NO se borran.")) return;
        await fetch("/api/usuario/" + id, { method: "DELETE" });
        toast("Acceso eliminado"); cargarProveedores();
      } else if (acc === "toggleuser") {
        const activo = b.dataset.activo === "1";
        await fetch("/api/usuario/" + id + "/activo", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ activo: !activo }) });
        toast(activo ? "Acceso desactivado" : "Acceso activado"); cargarProveedores();
      } else if (acc === "reset") {
        abrirReset(id, b.dataset.nom);
      } else if (acc === "tel") {
        abrirTel(id, b.dataset.nom, b.dataset.tel);
      } else if (acc === "wa") {
        const r = await (await fetch("/api/usuario/" + id + "/whatsapp")).json();
        if (r.error) { toast(r.error); return; }
        window.open(r.url, "_blank");
      }
    };
  });
}

/* ---------- agregar proveedor nuevo a la ficha (sin acceso todavia) ---------- */
$("#np-agregar").addEventListener("click", async () => {
  const nombre = $("#np-nombre").value.trim();
  const tipo = $("#np-tipo").value;
  if (!nombre) { toast("Escribe el nombre del proveedor o departamento"); return; }
  await fetch("/api/expediente", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nombre, tipo }) });
  $("#np-nombre").value = "";
  toast("Agregado a la ficha");
  cargarProveedores();
});

$("#buscar-prov").addEventListener("input", render);

/* ---------- modal: crear acceso ---------- */
function abrirAcceso(nombreProveedor, mundo){
  $("#ac-titulo").textContent = "Crear acceso · " + nombreProveedor;
  $("#ac-proveedor").value = nombreProveedor;
  $("#ac-mundo").value = mundo;
  $("#ac-usuario").value = ""; $("#ac-clave").value = ""; $("#ac-telefono").value = "";
  $("#modal-acceso").hidden = false;
  setTimeout(()=>$("#ac-usuario").focus(), 50);
}
function cerrarAcceso(){ $("#modal-acceso").hidden = true; }
$("#btn-cerrar-acceso").onclick = cerrarAcceso;
$("#btn-cancelar-acceso").onclick = cerrarAcceso;
$("#modal-acceso").onclick = (e)=>{ if(e.target.id==="modal-acceso") cerrarAcceso(); };
$("#btn-guardar-acceso").onclick = async () => {
  const usuario = $("#ac-usuario").value.trim();
  const clave = $("#ac-clave").value.trim();
  const telefono = $("#ac-telefono").value.trim();
  const proveedor = $("#ac-proveedor").value;
  const mundo = $("#ac-mundo").value;
  if (!usuario || !clave) { toast("Llena usuario y contraseña"); return; }
  const r = await (await fetch("/api/usuarios", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ usuario, clave, rol: "proveedor", mundo, proveedor, telefono }) })).json();
  if (r.error) { toast(r.error); return; }
  cerrarAcceso(); toast("Acceso creado"); cargarProveedores();
};

/* ---------- modal: ficha del proveedor ---------- */
function abrirFicha(nombre){
  const p = PROVS.find(x => x.nombre === nombre) || { nombre };
  $("#f-titulo").textContent = "Ficha · " + nombre;
  $("#f-nombre").value = nombre;
  $("#f-nombre-vis").value = nombre;
  $("#f-empresa").value = p.empresa || "";
  $("#f-tipo").value = p.tipo || "Externo";
  $("#f-funcion").value = p.funcion || "";
  $("#f-contacto").value = p.contacto || "";
  $("#f-telefono").value = p.telefono || "";
  $("#f-correo").value = p.correo || "";
  $("#f-notas").value = p.notas || "";
  $("#overlay-f").hidden = false; $("#overlay-f").style.display = "block";
  $("#panel-f").hidden = false; $("#panel-f").style.display = "flex";
}
function cerrarFicha(){
  $("#overlay-f").hidden = true; $("#overlay-f").style.display = "none";
  $("#panel-f").hidden = true; $("#panel-f").style.display = "none";
}
$("#f-cerrar").addEventListener("click", cerrarFicha);
$("#f-cancelar").addEventListener("click", cerrarFicha);
$("#overlay-f").addEventListener("click", cerrarFicha);
$("#f-guardar").addEventListener("click", async () => {
  const cuerpo = {
    nombre: $("#f-nombre").value, empresa: $("#f-empresa").value, tipo: $("#f-tipo").value,
    funcion: $("#f-funcion").value, contacto: $("#f-contacto").value,
    telefono: $("#f-telefono").value, correo: $("#f-correo").value, notas: $("#f-notas").value,
  };
  await fetch("/api/expediente", {
    method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(cuerpo) });
  cerrarFicha(); toast("Ficha guardada"); cargarProveedores();
});

/* ---------- modal: restablecer contraseña ---------- */
function abrirReset(id, nombre){
  $("#reset-id").value = id; $("#reset-nombre").textContent = nombre;
  $("#reset-clave").value = ""; $("#modal-reset").hidden = false;
  setTimeout(()=>$("#reset-clave").focus(), 50);
}
function cerrarReset(){ $("#modal-reset").hidden = true; }
$("#btn-cerrar-reset").onclick = cerrarReset;
$("#btn-cancelar-reset").onclick = cerrarReset;
$("#modal-reset").onclick = (e)=>{ if(e.target.id==="modal-reset") cerrarReset(); };
$("#btn-guardar-reset").onclick = async () => {
  const id = $("#reset-id").value;
  const clave = $("#reset-clave").value.trim();
  if (!clave) { toast("Escribe la contraseña nueva"); return; }
  const r = await (await fetch("/api/usuario/" + id + "/clave", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ clave }) })).json();
  if (r.error) { toast(r.error); return; }
  cerrarReset(); toast("Contraseña actualizada");
};

/* ---------- modal: telefono ---------- */
function abrirTel(id, nombre, tel){
  $("#tel-id").value = id; $("#tel-nombre").textContent = nombre;
  $("#tel-num").value = tel || ""; $("#modal-tel").hidden = false;
  setTimeout(()=>$("#tel-num").focus(), 50);
}
function cerrarTel(){ $("#modal-tel").hidden = true; }
$("#btn-cerrar-tel").onclick = cerrarTel;
$("#btn-cancelar-tel").onclick = cerrarTel;
$("#modal-tel").onclick = (e)=>{ if(e.target.id==="modal-tel") cerrarTel(); };
$("#btn-guardar-tel").onclick = async () => {
  const id = $("#tel-id").value;
  const telefono = $("#tel-num").value.trim();
  const r = await (await fetch("/api/usuario/" + id + "/telefono", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ telefono }) })).json();
  if (r.error) { toast(r.error); return; }
  cerrarTel(); toast("Teléfono guardado"); cargarProveedores();
};

/* ---------- arranque ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  cerrarAcceso(); cerrarFicha(); cerrarReset(); cerrarTel();
});

async function cargarTodo(){
  const q = await (await fetch("/api/quien_soy")).json();
  if (!q.login) { location.href = "/login"; return; }
  if (q.rol !== "admin") { location.href = "/portal"; return; }
  cerrarFicha();
  await cargarGenerales();
  await cargarProveedores();
}

cargarTodo();
