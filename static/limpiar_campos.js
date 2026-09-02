// Agrega un botón "✕" a un input de texto para borrar todo su contenido de un jalón.
// onClear opcional: función que se ejecuta después de limpiar (ej. limpiar campos dependientes).
function ponerBotonX(inputSel, onClear) {
  const input = document.querySelector(inputSel);
  if (!input || input.dataset.xlisto) return;
  input.dataset.xlisto = "1";
  
  // Envolver el input
  const wrap = document.createElement("span");
  wrap.className = "campo-x-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  
  // Botón X
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "campo-x-btn";
  btn.textContent = "✕";
  btn.title = "Limpiar este campo";
  
  function actualizarVisibilidad() {
    if (input.value && input.value.trim().length > 0) {
      btn.style.display = "flex";
      input.classList.add("tiene-valor");
    } else {
      btn.style.display = "none";
      input.classList.remove("tiene-valor");
    }
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.value = "";
    actualizarVisibilidad();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof onClear === "function") onClear();
    input.focus();
  });

  input.addEventListener("input", actualizarVisibilidad);
  input.addEventListener("change", actualizarVisibilidad);
  input.addEventListener("focus", actualizarVisibilidad);

  wrap.appendChild(btn);
  actualizarVisibilidad();
}
