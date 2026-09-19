// js/app.js
// Arranque, sesión, menú principal y navegación entre secciones.

import {
  estado, iniciarSupabase, cargarLocal, bajar, subirTodo, alSincronizar
} from "./datos.js";
import { cargarIndice, cargarUnidad, nombreBloque, claveUnidad } from "./contenido.js";
import { pintarUnidad } from "./vista-unidad.js";
import { panelEjercicios, panelVocabulario, panelConversar, avanceNivel } from "./vista-inicio.js";
import { armarSesion, correrSesion } from "./practica.js";

const $ = s => document.querySelector(s);
const esc = t => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ICONOS = {unidades: "◆", ejercicios: "✎", vocabulario: "❋", conversar: "◗"};

let temario = null;
let seccion = "unidades";
let actual = 1;
let apartado = 1;
let arrancada = false;
let peticion = 0;   // solo la última llamada a mostrar() pinta

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
    $("#portada-texto").textContent =
      "No se pudo cargar el temario. Revisa que la carpeta contenido esté publicada.";
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
    // sin base: no hay nada que pedir, se entra directo en modo local
    $("#portada-texto").textContent =
      "Sin conexión a la base: el progreso se guarda solo en este navegador.";
    ["email", "clave", "btn-entrar", "btn-crear"].forEach(id => {
      const e = $("#" + id); if(e) e.hidden = true;
    });
    $("#btn-sin-cuenta").textContent = "Entrar";
  }
})();

async function arrancar(){
  if(arrancada) return;
  arrancada = true;

  $("#portada").hidden = true;
  $("#marco").hidden = false;
  $("#sub-nivel").textContent = temario.nombre + " · " + temario.variante;
  $("#quien").textContent = estado.usuario ? estado.usuario.email : "sin cuenta, solo este navegador";
  $("#btn-salir").hidden = !estado.usuario;

  if(estado.usuario) subirTodo().catch(() => {});   // en segundo plano

  // al volver a la pestaña se baja lo último, pero sin bloquear lo que ya está pintado
  let ultimaBajada = 0;
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState !== "visible" || !estado.usuario) return;
    if(Date.now() - ultimaBajada < 30000) return;   // no en cada cambio de pestaña
    ultimaBajada = Date.now();
    bajar().then(() => {
      pintarMenu();
      // solo se repinta si estamos en una vista que muestra progreso
      if(seccion === "ejercicios") mostrarSeccion("ejercicios");
    }).catch(() => {});
  });

  const guardada = parseInt(localStorage.getItem("pattern-ultima") || "1", 10);
  actual = temario.unidades.some(u => u.numero === guardada) ? guardada : temario.unidades[0].numero;
  seccion = localStorage.getItem("pattern-seccion") || "unidades";
  if(!temario.secciones.some(s => s.id === seccion)) seccion = "unidades";

  pintarMenu();
  mostrarSeccion(seccion);
}

/* ================= menú principal ================= */
function pintarMenu(){
  const a = avanceNivel(temario);

  $("#secciones").innerHTML = temario.secciones.map(s => {
    const marca = s.estado === "pendiente" ? '<span class="marca-estado">pronto</span>'
                : s.estado === "parcial"   ? '<span class="marca-estado">en obra</span>' : "";
    return '<button data-s="' + s.id + '" class="' + (s.id === seccion ? "on" : "") + '">' +
      '<span class="ico">' + (ICONOS[s.id] || "•") + '</span>' +
      '<span class="tx"><b>' + esc(s.titulo) + '</b><span>' + esc(s.sub) + '</span></span>' +
      marca + '</button>';
  }).join("");

  document.querySelectorAll("#secciones button").forEach(b => {
    b.onclick = () => { cerrar(); mostrarSeccion(b.dataset.s); };
  });

  // la lista de unidades solo acompaña a la sección Unidades
  if(seccion !== "unidades"){
    $("#lista").innerHTML = "";
    return;
  }

  let h = '<span class="sec-lista">Unidades · ' + a.estudiadas + " de " + a.total + '</span>';
  let bl = null;
  temario.unidades.forEach(u => {
    if(u.bloque !== bl){
      bl = u.bloque;
      h += '<span class="sep">Bloque ' + bl + ' · ' + esc(nombreBloque(bl)) + '</span>';
    }
    const r = estado.progreso[claveUnidad(u.numero)];
    h += '<button class="' + (u.numero === actual ? "on " : "") +
         (u.tipo === "checkpoint" ? "chk " : "") + (r && r.ok ? "hecha" : "") +
         '" data-n="' + u.numero + '"><span class="n">' + u.numero + '</span>' +
         esc(u.titulo) + '</button>';
  });
  $("#lista").innerHTML = h;

  document.querySelectorAll("#lista button").forEach(b => {
    b.onclick = () => { cerrar(); mostrar(+b.dataset.n); };
  });
}

/* ================= secciones ================= */
function mostrarSeccion(id, mantener){
  document.onkeydown = null;
  seccion = id;
  localStorage.setItem("pattern-seccion", id);
  pintarMenu();

  const salida = $("#salida");
  const meta = temario.secciones.find(s => s.id === id);

  if(id === "unidades"){ mostrar(actual, mantener); return; }

  $("#titulo-movil").textContent = meta ? meta.titulo : "Pattern";
  window.scrollTo(0, 0);

  if(id === "ejercicios"){
    panelEjercicios(salida, temario, {
      irA: mostrarSeccion,
      alPracticar: unidad => practicar(unidad)
    });
  }
  else if(id === "vocabulario") panelVocabulario(salida, temario);
  else if(id === "conversar")   panelConversar(salida, temario);
}

/* ================= sesión de práctica ================= */
async function practicar(unidad){
  const salida = $("#salida");
  salida.innerHTML = '<p class="cargando">Armando la tanda...</p>';
  $("#titulo-movil").textContent = "Practicando";
  window.scrollTo(0, 0);

  let sesion;
  try { sesion = await armarSesion(unidad ? {unidad} : {tope: 20}); }
  catch(e){ salida.innerHTML = '<p class="cargando">No se pudieron cargar los ejercicios.</p>'; return; }

  if(!sesion.items.length){
    mostrarSeccion("ejercicios");
    return;
  }

  correrSesion(salida, sesion, {
    alRepetir: () => practicar(unidad),
    alSalir: () => { document.onkeydown = null; mostrarSeccion("ejercicios"); }
  });
}

/* ================= una unidad ================= */
async function mostrar(n, mantenerApartado){
  actual = n;
  seccion = "unidades";
  if(!mantenerApartado) apartado = 1;
  localStorage.setItem("pattern-ultima", n);
  localStorage.setItem("pattern-seccion", "unidades");

  const mia = ++peticion;   // si llega otra petición, esta deja de pintar
  const salida = $("#salida");
  const meta = temario.unidades.find(u => u.numero === n);
  $("#titulo-movil").textContent = meta ? meta.titulo : "Pattern";

  // solo se muestra "cargando" si de verdad hay que esperar
  const aviso = setTimeout(() => {
    if(mia === peticion) salida.innerHTML = '<p class="cargando">Cargando unidad...</p>';
  }, 150);

  let u;
  try { u = await cargarUnidad(n); }
  catch(e){
    clearTimeout(aviso);
    if(mia !== peticion) return;
    salida.innerHTML = '<p class="cargando">No se pudo cargar esta unidad. ' +
      '<button class="btn sec chico" id="reintentar">Reintentar</button></p>';
    const b = salida.querySelector("#reintentar");
    if(b) b.onclick = () => mostrar(n, true);
    return;
  }
  clearTimeout(aviso);
  if(mia !== peticion) return;   // llegó tarde: otra unidad ya se está mostrando

  const idx = temario.unidades.findIndex(x => x.numero === n);
  try {
  pintarUnidad(salida, u, {
    apartado,
    tieneEjercicios: !!(meta && meta.ejercicios),
    hayAnterior: idx > 0,
    haySiguiente: idx < temario.unidades.length - 1,
    alCambiarApartado: k => { apartado = k; mostrar(n, true); },
    alMarcar: () => { pintarMenu(); mostrar(n, true); },
    alNavegar: paso => {
      const sig = temario.unidades[idx + paso];
      if(sig){ mostrar(sig.numero); window.scrollTo(0, 0); }
    }
  });
  } catch(e){
    // un error al dibujar no puede dejar la pantalla en blanco
    console.error("Error al pintar la unidad", n, e);
    salida.innerHTML = '<p class="cargando">Hubo un problema al mostrar esta unidad. ' +
      '<button class="btn sec chico" id="reintentar">Reintentar</button></p>';
    const b = salida.querySelector("#reintentar");
    if(b) b.onclick = () => mostrar(n, true);
  }
  pintarMenu();
}
