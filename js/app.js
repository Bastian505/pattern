// js/app.js
// Arranque, sesión, menú lateral y navegación entre unidades.

import {
  estado, iniciarSupabase, cargarLocal, bajar, subirTodo, alSincronizar
} from "./datos.js";
import { cargarIndice, cargarUnidad, nombreBloque, claveUnidad, indice } from "./contenido.js";
import { pintarUnidad } from "./vista-unidad.js";

const $ = s => document.querySelector(s);
const esc = t => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let temario = null;
let actual = 1;       // número de unidad
let apartado = 1;
let arrancada = false;

alSincronizar((txt, malo) => {
  const e = $("#sync");
  if(!e) return;
  e.textContent = txt;
  e.style.color = malo ? "var(--coral)" : "var(--tinta-suave)";
});

/* ================= sesión ================= */
function credenciales(){
  const email = $("#email").value.trim();
  const clave = $("#clave").value;
  if(!email || !clave){ $("#error-login").textContent = "Escribe el correo y la contraseña."; return null; }
  if(clave.length < 6){ $("#error-login").textContent = "La contraseña necesita al menos 6 caracteres."; return null; }
  return {email, password: clave};
}

$("#btn-entrar").onclick = async () => {
  if(!estado.sb) return;
  $("#error-login").textContent = ""; $("#ok-login").textContent = "";
  const c = credenciales(); if(!c) return;
  const {data, error} = await estado.sb.auth.signInWithPassword(c);
  if(error){ $("#error-login").textContent = error.message; return; }
  estado.usuario = data.user;
  await bajar();
  arrancar();
};

$("#btn-crear").onclick = async () => {
  if(!estado.sb) return;
  $("#error-login").textContent = ""; $("#ok-login").textContent = "Creando cuenta...";
  const c = credenciales(); if(!c){ $("#ok-login").textContent = ""; return; }
  const {data, error} = await estado.sb.auth.signUp(c);
  if(error){ $("#ok-login").textContent = ""; $("#error-login").textContent = error.message; return; }
  if(data.session){
    estado.usuario = data.user;
    await bajar();
    arrancar();
  } else {
    $("#ok-login").textContent = "Cuenta creada. Ahora presiona Entrar.";
  }
};

$("#btn-sin-cuenta").onclick = () => arrancar();
$("#btn-salir").onclick = async () => {
  if(estado.sb) await estado.sb.auth.signOut();
  location.reload();
};
$("#clave").addEventListener("keydown", e => { if(e.key === "Enter") $("#btn-entrar").click(); });

/* ================= panel lateral ================= */
function abrir(){ $("#lado").classList.add("abierto"); $("#velo").classList.add("visible"); }
function cerrar(){ $("#lado").classList.remove("abierto"); $("#velo").classList.remove("visible"); }
$("#menu").onclick = () => $("#lado").classList.contains("abierto") ? cerrar() : abrir();
$("#velo").onclick = cerrar;

/* ================= arranque ================= */
(async function(){
  cargarLocal();
  try { temario = await cargarIndice(); }
  catch(e){
    $("#portada-texto").textContent = "No se pudo cargar el temario. Revisa que la carpeta contenido esté publicada.";
    return;
  }

  const sb = await iniciarSupabase();
  if(sb){
    sb.auth.onAuthStateChange(async (evento, sesion) => {
      if(sesion && sesion.user && !arrancada){
        estado.usuario = sesion.user;
        await bajar();
        arrancar();
      }
    });
    const {data} = await sb.auth.getSession();
    if(data && data.session){
      estado.usuario = data.session.user;
      await bajar();
      arrancar();
    }
  } else {
    $("#portada-texto").textContent = "Sin conexión a la base: el progreso se guardará solo en este navegador.";
  }
})();

async function arrancar(){
  if(arrancada) return;
  arrancada = true;

  $("#portada").hidden = true;
  $("#marco").hidden = false;
  $("#sub-nivel").textContent = temario.nombre + " \u00b7 " + temario.variante;
  $("#quien").textContent = estado.usuario ? estado.usuario.email : "sin cuenta, solo este navegador";
  $("#btn-salir").hidden = !estado.usuario;

  if(estado.usuario) await subirTodo();

  document.addEventListener("visibilitychange", async () => {
    if(document.visibilityState === "visible" && estado.usuario){
      await bajar();
      pintarLista();
      mostrar(actual);
    }
  });

  const guardada = parseInt(localStorage.getItem("pattern-ultima") || "1", 10);
  actual = temario.unidades.some(u => u.numero === guardada) ? guardada : temario.unidades[0].numero;
  pintarLista();
  mostrar(actual);
}

/* ================= menú de unidades ================= */
function pintarLista(){
  let h = "", bl = null, hechas = 0;
  temario.unidades.forEach(u => {
    if(u.bloque !== bl){
      bl = u.bloque;
      h += '<span class="sep">Bloque ' + bl + ' \u00b7 ' + esc(nombreBloque(bl)) + '</span>';
    }
    const r = estado.progreso[claveUnidad(u.numero)];
    if(r && r.ok) hechas++;
    h += '<button class="' + (u.numero === actual ? "on " : "") +
         (u.tipo === "checkpoint" ? "chk " : "") + (r && r.ok ? "hecha" : "") +
         '" data-n="' + u.numero + '"><span class="n">' + u.numero + '</span>' +
         esc(u.titulo) + '</button>';
  });
  $("#lista").innerHTML = h;
  $("#avance").textContent = hechas + " de " + temario.unidades.length + " unidades estudiadas";

  document.querySelectorAll("#lista button").forEach(b => {
    b.onclick = () => { cerrar(); mostrar(+b.dataset.n); };
  });
}

/* ================= mostrar una unidad ================= */
async function mostrar(n, mantenerApartado){
  actual = n;
  if(!mantenerApartado) apartado = 1;
  localStorage.setItem("pattern-ultima", n);

  const salida = $("#salida");
  const meta = temario.unidades.find(u => u.numero === n);
  $("#titulo-movil").textContent = meta ? meta.titulo : "Pattern";
  salida.innerHTML = '<p class="cargando">Cargando unidad...</p>';

  let u;
  try { u = await cargarUnidad(n); }
  catch(e){ salida.innerHTML = '<p class="cargando">No se pudo cargar esta unidad.</p>'; return; }

  const idx = temario.unidades.findIndex(x => x.numero === n);
  pintarUnidad(salida, u, {
    apartado,
    hayAnterior: idx > 0,
    haySiguiente: idx < temario.unidades.length - 1,
    alCambiarApartado: k => { apartado = k; mostrar(n, true); },
    alMarcar: () => { pintarLista(); mostrar(n, true); },
    alNavegar: paso => {
      const sig = temario.unidades[idx + paso];
      if(sig){ pintarLista(); mostrar(sig.numero); window.scrollTo(0, 0); }
    }
  });
  pintarLista();
}
