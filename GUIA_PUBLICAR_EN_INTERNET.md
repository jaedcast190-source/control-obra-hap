# CÓMO PUBLICAR LA PLATAFORMA EN INTERNET
### Para que los proveedores capturen desde su celular en la obra
Versión 1.6 · 2 de septiembre de 2026

---

## PRIMERO: por qué NO Netlify ni Supabase solos

**Netlify no sirve para esto.** Netlify aloja páginas estáticas (HTML suelto).
Tu plataforma es un **servidor Python con base de datos**: necesita una
computadora encendida ejecutando el programa. Netlify no hace eso.

**Supabase tampoco es el lugar donde vive la aplicación.** Supabase es una
**base de datos** en la nube. Podría servir más adelante para guardar los datos,
pero alguien tiene que ejecutar el programa. Supabase no ejecuta Python.

**Lo que sí funciona: Render.** Es el más simple para lo tuyo y el que
recomiendo. La alternativa es PythonAnywhere.

---

## LA ADVERTENCIA MÁS IMPORTANTE

En los planes **gratuitos**, el disco se borra cada vez que se actualiza la
aplicación o el servidor se reinicia. **Perderías la base de datos completa**,
con todo lo que hayan capturado los proveedores.

Con gente capturando de verdad, eso no es aceptable.
Por eso la configuración que te dejo incluye un **disco persistente**, que es
de paga. Son unos **7 dólares al mes** el servicio, más **0.25 dólares al mes**
por el disco de 1 GB. Alrededor de **130 pesos mensuales**.

Ya viene configurado en el archivo `render.yaml`. No tienes que hacer nada
técnico, solo elegir el plan de paga cuando te lo pida.

---

## ANTES DE PUBLICAR: tres cosas de seguridad

En cuanto esto esté en internet, cualquiera con la dirección puede intentar
entrar. Haz estas tres cosas **el mismo día**:

1. **Cambia la contraseña de admin.** La actual, `HAP2026`, ya la conoce
   demasiada gente. Entra con tu usuario, botón **🔑 Mi contraseña**, cámbiala
   por una que solo tú sepas.

2. **Dale una contraseña distinta a cada proveedor.** Nunca la misma para
   todos. Cada uno solo ve lo suyo, pero si comparten contraseña pierdes el
   rastro de quién reportó qué.

3. **Baja un respaldo cada semana.** El botón **💾 Respaldo** de tu pantalla
   principal. Guárdalo en tu computadora o en una USB. Aunque el disco sea
   persistente, un respaldo tuyo es tu seguro real.

---

## PASOS PARA PUBLICAR EN RENDER

### Paso 1 — Crear la cuenta
Entra a **https://render.com** y regístrate. Puedes usar tu correo de Google.

### Paso 2 — Subir el código a GitHub
Render toma el código desde GitHub.

1. Crea cuenta en **https://github.com** si no tienes.
2. Botón verde **New** → nombre del repositorio: `control-obra-hap`
3. Márcalo como **Private** (privado). Esto es importante: no quieres que
   cualquiera vea el código de tu obra.
4. Botón **uploading an existing file** y arrastra **todo el contenido** de la
   carpeta `plataforma_control_obra_HAP` (los archivos y las carpetas
   `static` y `templates`).
5. **No subas la carpeta `data`.** Esa es tu base de datos; va aparte.
6. Botón **Commit changes**.

### Paso 3 — Crear el servicio en Render
1. En Render: **New** → **Web Service**
2. Conecta tu cuenta de GitHub y elige el repositorio `control-obra-hap`.
3. Render leerá solo el archivo `render.yaml` y llenará casi todo.
   Si te pide los datos a mano, usa estos:
   - **Language / Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120`
   - **Plan:** Starter (el de paga, ~7 USD/mes)
4. En **Advanced** → **Add Disk**:
   - **Name:** `datos-hap`
   - **Mount Path:** `/var/data`
   - **Size:** 1 GB
5. En **Environment Variables** agrega:
   - `DATA_DIR` = `/var/data`
   - `EN_INTERNET` = `1`
   - `SECRET_KEY` = (pica en *Generate* para que Render invente una)
6. Botón **Create Web Service**.

Espera unos 3 a 5 minutos. Render te dará una dirección así:

```
https://control-obra-hap.onrender.com
```

**Esa es la liga que les pasas a los proveedores.**
Se abre igual en cualquier celular, sin instalar nada.

### Paso 4 — Subir tu base de datos actual
Tu base con las 955 partidas hay que subirla al disco nuevo.

En Render, entra a tu servicio → pestaña **Shell**, y ahí puedes subir el
archivo `obra.db` a la carpeta `/var/data`. Si se te complica este paso,
dímelo y lo vemos juntos: es el único que tiene chiste.

Alternativa más simple: entras a la plataforma ya publicada y usas
**Reportes → Captura rápida por Excel** para cargar el avance.

### Paso 5 — Probar desde un celular
1. Abre la liga en tu propio celular.
2. Entra con `admin` y tu contraseña nueva.
3. Crea un usuario de prueba y entra con él desde otro teléfono.
4. Reporta un avance y confirma que te llegue a Validación.

Hasta que esto funcione, no repartas la liga.

---

## CÓMO SE LOS PASAS A LOS PROVEEDORES

Mándales esto por WhatsApp, uno por uno (cada quien su usuario):

> Buen día. Ya está lista la plataforma para reportar el avance de la obra
> de Quirófanos. Se abre desde el celular, no hay que instalar nada.
>
> Liga: https://control-obra-hap.onrender.com
> Usuario: _____
> Contraseña: _____
>
> Al entrar verán sus partidas. Primero confirmen que el trabajo es suyo
> con "Sí es mi trabajo", y de ahí ya pueden reportar el porcentaje.
> Lo que reporten me llega a mí para revisarlo.
>
> Les pido cambiar su contraseña al entrar, con el botón "Mi contraseña".

**Consejo:** que cada quien le dé "Agregar a pantalla de inicio" en el
navegador del celular. Les queda como si fuera una aplicación.

---

## SI PREFIERES PYTHONANYWHERE

Es más barato (unos 5 dólares al mes) y no necesita GitHub: subes un ZIP
directo. Pero la configuración es más manual y la pantalla es más confusa.

Si Render se te complica, dime y te hago la guía de PythonAnywhere paso a paso.

---

## LO QUE VIENE DESPUÉS (cuando ya esté corriendo)

Cosas que conviene atender una vez que los proveedores estén capturando:

- **Respaldo automático a la nube**, para no depender de que te acuerdes.
- **Migrar de SQLite a Postgres** (aquí sí entra Supabase). SQLite aguanta
  bien lo que tienes, pero si un día entran muchos proveedores a la vez a
  escribir, Postgres es más sólido. No es urgente hoy.
- **Dominio propio**, por ejemplo `obra.arandadelaparra.com`, en vez de la
  dirección de Render. Se configura en un rato.

---

## SI ALGO FALLA

- **"Application failed to respond"** → revisa en Render la pestaña **Logs**.
  Casi siempre es que falta una variable de entorno.
- **Entra pero no hay actividades** → falta subir tu `obra.db` al disco
  (Paso 4), o cargar el avance por Excel.
- **Se perdieron datos tras una actualización** → el disco persistente no
  quedó bien montado. Revisa que `DATA_DIR` sea `/var/data` y que el disco
  esté montado en esa misma ruta.
