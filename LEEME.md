# Plataforma de Control de Obra — Unidad Quirúrgica HAP

Aplicación local para capturar el avance de cada actividad de la obra,
detectar retrasos frente a la fecha de entrega (**31 de octubre de 2026**)
y generar un reporte para dirección.

Todo corre **en tu computadora**. La base de datos es un archivo local
(`data/obra.db`). No usa internet ni la nube. Tus datos son solo tuyos.

---

## 1. Requisito único: Python

Necesitas Python 3 instalado. Para saber si ya lo tienes, abre una terminal
(en Windows: busca "cmd" o "PowerShell") y escribe:

```
python --version
```

Si te responde algo como `Python 3.11.x`, ya está.
Si no, descárgalo de https://www.python.org/downloads/ y durante la
instalación **marca la casilla "Add Python to PATH"**.

---

## 2. Instalación (una sola vez)

Abre la terminal, entra a esta carpeta y ejecuta:

```
cd ruta/donde/pusiste/plataforma_hap
pip install flask openpyxl reportlab
```

(En algunas computadoras el comando es `pip3` en vez de `pip`.)

`reportlab` es para generar los PDF del centro de reportes. Si no lo instalas,
todo lo demás funciona igual; solo no saldrán los PDF.

---

## 3. Cargar tus actividades

La base de datos ya viene con tus **945 actividades** cargadas del maestro.
No necesitas hacer nada más para empezar.

Si más adelante quieres volver a cargar desde un Excel actualizado:

```
python importar.py "BORRADOR_MAESTRO_REVISION.xlsx"
```

Te preguntará si reemplazar lo que ya hay. Responde `s` para sí.

---

## 4. Abrir la plataforma

Cada vez que quieras usarla:

```
python app.py
```

Verás un mensaje con la dirección. Abre tu navegador (Chrome, Edge, etc.)
y entra a:

```
http://localhost:5000
```

Para **apagarla**, regresa a la terminal y presiona `Ctrl + C`.

---

## 5. Cómo se usa

**Pantalla de captura (inicio):**
- Arriba ves el tablero: avance global, cuántas actividades hay, cuántas
  van en proceso, listas, retrasadas y en riesgo.
- El número grande de la esquina es **cuántos días faltan** para el 31 de octubre.
- Usa los filtros (bloque, área, giro, estatus) o el buscador para encontrar
  actividades rápido.
- **Haz clic en cualquier renglón** para abrir el panel de edición. Ahí pones:
  el % de avance, fechas de inicio y fin, de qué otra actividad depende, el
  estatus y notas. El estatus se ajusta solo según el avance (puedes
  cambiarlo a mano).
- Botón **"+ Nueva actividad"** para agregar algo que no estaba en la lista.
- Botón **"Exportar a Excel"** para bajar todo el avance a una hoja de cálculo.

**Reporte para dirección:**
- Botón amarillo arriba a la derecha: **"Reporte para dirección →"**.
- Muestra avance global, avance por bloque, avance por giro/contratista,
  la lista de **actividades retrasadas** y las **próximas a vencer**.
- Botón **"Imprimir / Guardar PDF"**: en el diálogo de impresión elige
  "Guardar como PDF" y ya tienes el documento para enviar al director.

---

## 5-bis. Funciones nuevas

**Causa de retraso (en el panel de cada actividad):**
- Al abrir una actividad, abajo hay un recuadro para anotar **por qué** va
  atrasada. Eliges una de las 7 causas o agregas una nueva con "+ Agregar causa".
- El campo **"Lo que sostiene el proveedor"** es para su versión: siempre
  tiene derecho de réplica. Se guarda quién registró la causa y en qué fecha.
- En el reporte a dirección las causas se ven **sumadas** (cuántas partidas
  por cada causa), no señalando a nadie en particular.

**Expediente de proveedores:**
- Botón **"Expediente proveedores"** arriba. Una tarjeta por cada proveedor.
- Da clic para llenar razón social, tipo (interno/externo), giro, persona de
  contacto, teléfono, correo y notas. Se guarda aparte del avance de la obra.

**Foto semanal (comparar avance):**
- Botón **"📸 Guardar foto semanal"**. Guarda una foto del avance de hoy.
- La próxima semana, al guardar otra, puedes comparar cuánto se movió cada
  proveedor. Ideal para llevar a la junta de obra.

---

## 5-ter. Portal de proveedores (captura en línea con tu validación)

Ahora los proveedores pueden reportar su avance ellos mismos, pero **nada
entra a tu control sin que tú lo firmes**.

**Cómo entra cada quien:**
- Tú entras con el usuario **admin** (contraseña inicial `HAP2026` — cámbiala).
- Ve a **"Usuarios / accesos"** (botón dentro de Validación) y crea un usuario
  para cada proveedor: le pones un usuario, una contraseña y eliges su empresa.
  Tú le pasas esos datos al proveedor.

**Qué ve el proveedor:**
- Entra en la página de login con su usuario. Solo ve **las actividades de su
  empresa** que tú ya cargaste.
- Escribe su avance (0/25/50/75/100), fechas, y marca de dónde salió el trabajo
  (plano, adicional o comentario — esto lo protege a él).
- Puede **agregar** una actividad nueva si le falta alguna.

**Las dos formas en que te llega:**
- **Avance en una partida que ya era suya** → entra como *avance reportado*
  (en amarillo), no toca tu número oficial hasta que firmas.
- **Actividad nueva que propone** → queda *esperando validación*, no aparece en
  el control hasta que la apruebas.

**Tu validación:**
- El botón **"Validación"** (arriba en tu pantalla) muestra un número rojo con
  cuántas cosas tienes por revisar.
- Ahí ves lo reportado y lo propuesto, y das **Firmar/Aprobar** o **Rechazar**.
  Solo lo que firmas entra al avance oficial que ve dirección.

**El proveedor tiene que RECONOCER su trabajo (sí o sí):**
- Toda actividad que le asignas le aparece en **rojo, "por reconocer"**.
- Hasta que no le dé **"✓ Sí es mi trabajo"**, NO puede reportar avance en ella.
  Así el patrón queda obligado a que su gente revise lo que se le asignó.
- Si algo no le toca, marca **"No lo reconozco"** con un comentario, y te llega
  a ti en la sección "Necesitan tu atención" para corregirlo.
- El proveedor puede reconocer en lote: el botón **"🔔 Nuevas asignadas"** lo
  lleva a lo pendiente, y con el filtro de bloque puede aceptar todo un bloque
  de una vez.

**Historial de cada actividad:**
- En tu tabla, el ícono 🕑 de cada renglón abre la línea de tiempo de esa
  partida: cada cambio de avance, fecha o nota, con quién lo hizo y cuándo.
  Nada se borra sin dejar rastro.

**Necesitan tu atención (en el panel de Validación):**
- Las actividades que un proveedor **no reconoce** (con lo que dijo), para que
  las corrijas.
- Las que **rechazaste**, por si quieres reactivar alguna. No se pierden.

**Buscar sin acentos:**
- La búsqueda ya no distingue acentos ni mayúsculas: "recuperacion" encuentra
  "Recuperación". Aplica en tu pantalla y en la del proveedor.

> **Nota de seguridad:** mientras la plataforma corra solo en tu computadora,
> el portal funciona en tu red local. Para que los proveedores entren desde
> fuera (su celular en la obra), hay que publicarla en internet — eso es la
> Etapa 2, que se hace aparte y con cuidado.

---

## 6. Respaldo de tus datos

Todo vive en el archivo **`data/obra.db`**. Para respaldar, simplemente
copia ese archivo a otra carpeta o a una USB. Para restaurar, lo pegas de
vuelta. Nada más.

---

## Estructura de archivos

```
plataforma_hap/
├── app.py              ← el servidor (esto es lo que corres)
├── importar.py         ← carga el Excel a la base de datos
├── LEEME.md            ← este instructivo
├── data/
│   └── obra.db         ← TU BASE DE DATOS (respáldala)
├── templates/          ← las páginas web
└── static/             ← estilos e interactividad
```

---

## Si algo falla

- **"python no se reconoce…"** → Python no está en el PATH. Reinstálalo
  marcando "Add Python to PATH", o usa `py` en lugar de `python`.
- **"No module named flask"** → falta el paso 2 (`pip install flask openpyxl`).
- **La página no abre** → revisa que la terminal siga mostrando el servidor
  corriendo; si la cerraste, vuelve a correr `python app.py`.
- **Quiero empezar de cero** → borra `data/obra.db` y corre `python importar.py`.
