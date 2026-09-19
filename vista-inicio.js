// js/vista-inicio.js
// Paneles de las secciones: Ejercicios (con su portada), Mi vocabulario y Conversar.

import { estado } from "./datos.js";
import { claveUnidad } from "./contenido.js";
import { contarPendientes } from "./practica.js";

const esc = t => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Cuenta unidades estudiadas por bloque y devuelve el resumen del nivel. */
export function avanceNivel(temario){
  const porBloque = new Map();
  let estudiadas = 0, conEjercicios = 0;

  temario.unidades.forEach(u => {
    if(!porBloque.has(u.bloque)) porBloque.set(u.bloque, {total: 0, hechas: 0});
    const b = porBloque.get(u.bloque);
    b.total++;
    const r = estado.progreso[claveUnidad(u.numero)];
    if(r && r.ok){ b.hechas++; estudiadas++; }
    if(u.ejercicios) conEjercicios++;
  });

  return {porBloque, estudiadas, conEjercicios, total: temario.unidades.length};
}

export function siguienteUnidad(temario){
  return temario.unidades.find(u => {
    const r = estado.progreso[claveUnidad(u.numero)];
    return !(r && r.ok);
  }) || null;
}

/* ---------------- Ejercicios: la portada de práctica ---------------- */
export async function panelEjercicios(destino, temario, opciones){
  const o = opciones || {};
  destino.innerHTML = '<p class="cargando">Preparando la práctica...</p>';

  const p = await contarPendientes();
  const listas = temario.unidades.filter(u =>
    u.ejercicios && (estado.progreso[claveUnidad(u.numero)] || {}).ok);
  const esperando = temario.unidades.filter(u =>
    u.ejercicios && !(estado.progreso[claveUnidad(u.numero)] || {}).ok);
  const hayQuePracticar = p.vencidos + p.nuevos;

  let h = '<div class="panel"><h2>Ejercicios</h2>' +
    '<p class="intro">Una unidad entra al pool cuando la marcas como estudiada. ' +
    'Desde ahí vuelve sola cada cierto tiempo, cada vez más espaciada.</p>';

  h += '<div class="resumen-avance">' +
    '<div class="dato"><div class="v">' + p.vencidos + '</div><div class="k">para repasar hoy</div></div>' +
    '<div class="dato"><div class="v">' + p.nuevos + '</div><div class="k">sin hacer todavía</div></div>' +
    '<div class="dato"><div class="v">' + listas.length + '</div><div class="k">unidades activas</div></div>' +
    '</div>';

  if(hayQuePracticar){
    const cuantos = Math.min(20, hayQuePracticar);
    h += '<div class="proximo"><div class="et">' +
      (p.vencidos ? "Toca repasar" : "Listo para empezar") + '</div>' +
      '<h3>' + cuantos + (cuantos === 1 ? " ejercicio" : " ejercicios") + ' en esta tanda</h3>' +
      '<p>' + (p.vencidos
        ? "Empieza por lo que ya hiciste y toca repasar, y sigue con lo nuevo."
        : "Van en orden, de lo más simple a escribir tus propias frases.") + '</p>' +
      '<button class="btn" id="practicar">Practicar</button></div>';
  } else if(listas.length){
    h += '<div class="proximo"><div class="et">Al día</div>' +
      '<h3>Nada pendiente por ahora</h3>' +
      '<p>Terminaste todo lo disponible. Vuelve mañana para el repaso, ' +
      'o marca otra unidad como estudiada para sumar ejercicios.</p></div>';
  } else if(esperando.length){
    h += '<div class="proximo"><div class="et">Falta un paso</div>' +
      '<h3>Marca una unidad como estudiada</h3>' +
      '<p>Los ejercicios de las unidades ' + esperando.map(u => u.numero).join(", ") +
      ' ya están escritos, pero no entran al pool hasta que leas la unidad y la marques.</p>' +
      '<button class="btn" id="ir-unidades">Ir a las unidades</button></div>';
  }

  if(listas.length){
    h += '<h3 class="sub-lista">O practica una unidad en concreto</h3><div class="unidades-ej">' +
      listas.map(u => '<button class="chip-unidad" data-n="' + u.numero + '">' +
        '<b>' + u.numero + '</b> ' + esc(u.titulo) + '</button>').join("") + '</div>';
  }

  if(temario.unidades.filter(u => u.ejercicios).length < temario.unidades.length){
    h += '<p class="aviso-obra">Por ahora hay ejercicios escritos para las unidades 1 a 6. ' +
      'Las demás tienen la ficha completa, pero todavía no su práctica.</p>';
  }

  h += '</div>';
  destino.innerHTML = h;

  const bp = destino.querySelector("#practicar");
  if(bp) bp.onclick = () => o.alPracticar && o.alPracticar();

  const bu = destino.querySelector("#ir-unidades");
  if(bu) bu.onclick = () => o.irA && o.irA("unidades");

  destino.querySelectorAll(".chip-unidad").forEach(b => {
    b.onclick = () => o.alPracticar && o.alPracticar(+b.dataset.n);
  });
}

/* ---------------- Mi vocabulario ---------------- */
export function panelVocabulario(destino, temario){
  let h = '<div class="panel"><h2>Mi vocabulario</h2>' +
    '<p class="intro">Todo el vocabulario del nivel en un solo lugar, más las palabras y ' +
    'expresiones que agregues tú. De aquí salen las tarjetas de repaso.</p>';

  h += '<div class="resumen-avance">' +
    '<div class="dato"><div class="v">507</div><div class="k">palabras del nivel A1</div></div>' +
    '<div class="dato"><div class="v">0</div><div class="k">agregadas por ti</div></div>' +
    '<div class="dato"><div class="v">0</div><div class="k">marcadas como sabidas</div></div>' +
    '</div>';

  h += '<div class="pronto"><h3>Lo que va a tener</h3><ul>' +
    '<li><b>Buscador</b> sobre las 507 palabras del nivel, con su unidad de origen.</li>' +
    '<li><b>Agregar lo tuyo</b>: una palabra o expresión que aprendiste por fuera, con su significado y ejemplos.</li>' +
    '<li><b>Tarjetas</b> con repaso espaciado, mezclando el vocabulario del curso y el tuyo.</li>' +
    '<li><b>How do you say?</b>: preguntas cómo se dice algo y la respuesta se guarda acá.</li>' +
    '</ul></div>';

  h += '<p class="intro" style="margin-top:22px">Por ahora el vocabulario de cada unidad ' +
    'está en su propia ficha, en la pestaña Vocabulario.</p></div>';

  destino.innerHTML = h;
}

/* ---------------- Conversar ---------------- */
export function panelConversar(destino, temario){
  const a = avanceNivel(temario);
  const checkpoints = temario.unidades.filter(u => u.tipo === "checkpoint");

  let h = '<div class="panel"><h2>Conversar</h2>' +
    '<p class="intro">Dos cosas distintas van a vivir aquí: la práctica diaria sin nota, ' +
    'y el examen que decide si pasas de bloque.</p>';

  h += '<div class="tarjetas">';

  h += '<div class="tarjeta-sec"><div class="n">1</div><div class="cuerpo">' +
    '<h3>Día a Día</h3>' +
    '<p>Cuentas lo que hiciste hoy y la IA te corrige, en español, sin nota ni presión. ' +
    'Necesita el pasado simple, que entra en el bloque 6.</p></div></div>';

  h += '<div class="tarjeta-sec"><div class="n">2</div><div class="cuerpo">' +
    '<h3>Examen de bloque</h3>' +
    '<p>Una conversación al cerrar cada bloque. No juzga si hablas bien en general: ' +
    'verifica una lista concreta de criterios y te dice cuál falló. Son ' +
    checkpoints.length + ' en todo el nivel.</p></div></div>';

  h += '<div class="tarjeta-sec"><div class="n">3</div><div class="cuerpo">' +
    '<h3>Conversación libre</h3>' +
    '<p>La IA conversa usando solo el vocabulario y las estructuras que ya dominas, ' +
    'y cae al español para explicarte algo nuevo.</p></div></div>';

  h += '</div>';

  h += '<div class="pronto" style="margin-top:24px"><h3>Estado</h3><ul>' +
    '<li>Los criterios de aprobación ya están escritos para las unidades del bloque 1.</li>' +
    '<li>Llevas <b>' + a.estudiadas + ' de ' + a.total + '</b> unidades estudiadas.</li>' +
    '</ul></div></div>';

  destino.innerHTML = h;
}
