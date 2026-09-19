// js/vista-unidad.js
// Dibuja una unidad: cabecera, pestañas de apartado y el cierre para marcarla.

import { claveUnidad } from "./contenido.js";
import { estado, marcar } from "./datos.js";

export const esc = t => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const li = a => (a || []).map(t => "<li>" + esc(t) + "</li>").join("");

export const APARTADOS = [
  {k: 1, t: "De qué se trata"},
  {k: 2, t: "Cómo se arma"},
  {k: 3, t: "Ejemplos"},
  {k: 4, t: "Ojo con esto"},
  {k: 5, t: "Vocabulario"}
];

function apartadoHTML(u, k){
  if(k === 1){
    return '<div class="bloque b1"><h3><span class="num">1</span>De qué se trata</h3><ul>' +
      li(u.concepto.puntos) + '</ul><div class="clave">' + esc(u.concepto.clave) + '</div></div>';
  }
  if(k === 2){
    return '<div class="bloque b2"><h3><span class="num">2</span>Cómo se arma</h3><div class="formula">' +
      u.estructura.filas.map(f =>
        '<div class="fila"><span class="et">' + esc(f.etiqueta) + '</span><span class="fo">' +
        esc(f.formula) + '</span></div>').join("") +
      '</div><ul>' + li(u.estructura.notas) + '</ul></div>';
  }
  if(k === 3){
    return '<div class="bloque b3"><h3><span class="num">3</span>Ejemplos</h3><div class="pares">' +
      u.ejemplos.map(e =>
        '<div class="par"><span class="en">' + esc(e.en) + '</span><span class="es">' + esc(e.es) + '</span>' +
        (e.nota ? '<span class="nt">' + esc(e.nota) + '</span>' : '') + '</div>').join("") +
      '</div></div>';
  }
  if(k === 4){
    return '<div class="bloque b4"><h3><span class="num">4</span>Ojo con esto</h3><ul>' +
      li(u.ojo.puntos) + '</ul><div class="contraste">' +
      u.ojo.contrastes.map(c =>
        '<div class="cpar"><div class="mal">\u2715 ' + esc(c.mal) + '</div><div class="bien">\u2713 ' +
        esc(c.bien) + '</div><div class="pq">' + esc(c.por_que) + '</div></div>').join("") +
      '</div></div>';
  }
  return '<div class="bloque b5"><h3><span class="num">5</span>Vocabulario de la unidad</h3><div class="voc">' +
    u.vocabulario.map(v =>
      '<div class="vitem"><div class="en">' + esc(v.en) + '</div><div class="es">' + esc(v.es) + '</div>' +
      (v.nota ? '<div class="nt">' + esc(v.nota) + '</div>' : '') + '</div>').join("") +
    '</div></div>';
}

/**
 * Pinta la unidad dentro de `destino`.
 * opciones: { apartado, alCambiarApartado, alMarcar, alNavegar, hayAnterior, haySiguiente }
 */
export function pintarUnidad(destino, u, opciones){
  const o = opciones || {};
  const apartado = o.apartado || 1;
  const hayVoc = u.vocabulario && u.vocabulario.length;
  const disp = APARTADOS.filter(a => a.k !== 5 || hayVoc);

  let h = '<div class="cab"><div class="eti">Unidad ' + u.numero +
    (u.tipo === "checkpoint" ? " \u00b7 checkpoint" : "") + '</div>' +
    '<h2>' + esc(u.titulo) + '</h2>' +
    '<p class="puedes">' + esc(u.puedes) + '</p>' +
    '<div class="gram">' + esc(u.gramatica) + '</div></div>';

  h += '<div class="apartados">' + disp.map(a =>
    '<button data-k="' + a.k + '" class="' + (a.k === apartado ? "on" : "") +
    '"><span class="p"></span>' + a.t + '</button>').join("") + '</div>';

  h += apartadoHTML(u, apartado);

  const r = estado.progreso[claveUnidad(u.numero)];
  const hecha = r && r.ok;
  const conEj = o.tieneEjercicios;
  const texto = hecha
    ? (conEj ? "Marcada como estudiada: sus ejercicios ya entraron al pool de práctica."
             : "Ya marcaste esta unidad como estudiada.")
    : (conEj ? "Cuando la tengas clara, márcala: sus ejercicios entran al pool de práctica."
             : "Cuando la tengas clara, márcala. Sus ejercicios todavía no están escritos.");
  h += '<div class="cierre"><p>' + texto +
    '</p><button class="btn' + (hecha ? " hecho" : "") + '" id="marcar">' +
    (hecha ? "Estudiada \u2713" : "Marcar como estudiada") + '</button></div>';

  h += '<div class="pie">' +
    '<button id="ant"' + (o.hayAnterior ? "" : " disabled") + '>\u2190 Anterior</button>' +
    '<button id="sig"' + (o.haySiguiente ? "" : " disabled") + '>Siguiente \u2192</button></div>';

  destino.innerHTML = h;

  destino.querySelectorAll(".apartados button").forEach(b => {
    b.onclick = () => o.alCambiarApartado && o.alCambiarApartado(+b.dataset.k);
  });

  const bm = destino.querySelector("#marcar");
  if(bm) bm.onclick = () => {
    const actual = estado.progreso[claveUnidad(u.numero)];
    marcar(claveUnidad(u.numero), "unidad", !(actual && actual.ok));
    o.alMarcar && o.alMarcar();
  };

  const a = destino.querySelector("#ant"), s = destino.querySelector("#sig");
  if(a) a.onclick = () => o.alNavegar && o.alNavegar(-1);
  if(s) s.onclick = () => o.alNavegar && o.alNavegar(1);
}
