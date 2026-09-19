// js/practica.js
// El motor de ejercicios: arma la sesión, presenta un ítem a la vez,
// corrige y programa el repaso.

import { estado, programar, hoy } from "./datos.js";
import { cargarEjercicios, claveUnidad, claveItem, indice } from "./contenido.js";

const esc = t => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------------- comparación de respuestas ---------------- */
export function normalizar(t){
  return (t || "")
    .toLowerCase()
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/[.,!?;:]+$/, "")
    .trim();
}

/* Acepta la respuesta principal o cualquiera de las alternativas. */
export function acierta(dado, item){
  const a = normalizar(dado);
  if(!a) return false;
  const validas = [item.respuesta].concat(item.alternativas || []);
  return validas.some(v => {
    const b = normalizar(v);
    if(a === b) return true;
    // "-" marca la ausencia de artículo: se acepta también vacío o un guion
    if(b === "-" && (a === "-" || a === "nada" || a === "ninguno")) return true;
    return false;
  });
}

/* ---------------- armado de la sesión ---------------- */

/* Aplana un archivo de ejercicios en ítems sueltos con su clave. */
function aplanar(ej, unidad){
  const fuera = [];
  (ej.tandas || []).forEach(t => {
    (t.items || []).forEach((it, i) => {
      fuera.push({
        clave: claveItem(unidad, t.id, i),
        unidad,
        tanda: t.id,
        tipo: t.tipo,
        ia: !!t.ia,
        instruccion: t.instruccion,
        item: it,
        orden: fuera.length
      });
    });
  });
  return fuera;
}

/**
 * Arma la sesión de práctica.
 *  - modo "propuesta": lo vencido de repaso primero, y después lo nuevo.
 *  - modo "unidad": solo esa unidad, de principio a fin.
 * Devuelve {items, vencidos, nuevos}.
 */
export async function armarSesion(opciones){
  const o = opciones || {};
  const h = hoy();
  const disponibles = indice.unidades.filter(u =>
    u.ejercicios && (estado.progreso[claveUnidad(u.numero)] || {}).ok);

  const unidades = o.unidad
    ? disponibles.filter(u => u.numero === o.unidad)
    : disponibles;

  let todos = [];
  for(const u of unidades){
    const ej = await cargarEjercicios(u.numero);
    if(ej) todos = todos.concat(aplanar(ej, u.numero));
  }

  if(o.unidad){
    return {items: todos, vencidos: 0, nuevos: todos.length};
  }

  const vencidos = [], nuevos = [];
  todos.forEach(x => {
    const r = estado.progreso[x.clave];
    if(!r || !r.intentos) nuevos.push(x);
    else if(r.proxima && r.proxima <= h) vencidos.push(x);
  });

  // los vencidos van mezclados; los nuevos, en el orden en que fueron escritos
  vencidos.sort(() => Math.random() - 0.5);
  const tope = o.tope || 20;
  const items = vencidos.concat(nuevos).slice(0, tope);

  return {items, vencidos: vencidos.length, nuevos: nuevos.length};
}

/* Cuenta lo pendiente sin armar la sesión entera (para el panel). */
export async function contarPendientes(){
  const h = hoy();
  const disponibles = indice.unidades.filter(u =>
    u.ejercicios && (estado.progreso[claveUnidad(u.numero)] || {}).ok);
  let vencidos = 0, nuevos = 0;
  for(const u of disponibles){
    const ej = await cargarEjercicios(u.numero);
    if(!ej) continue;
    aplanar(ej, u.numero).forEach(x => {
      const r = estado.progreso[x.clave];
      if(!r || !r.intentos) nuevos++;
      else if(r.proxima && r.proxima <= h) vencidos++;
    });
  }
  return {vencidos, nuevos, unidades: disponibles.length};
}

/* ---------------- la vista ---------------- */

const ETIQUETA = {
  elegir: "Elige", completar: "Completa", ordenar: "Ordena",
  transformar: "Transforma", corregir: "Corrige", traducir: "Traduce"
};

export function correrSesion(destino, sesion, opciones){
  const o = opciones || {};
  let i = 0, aciertos = 0, fallos = 0;
  const fallados = [];

  function pintar(){
    if(i >= sesion.items.length) return final();

    const x = sesion.items[i];
    const it = x.item;
    const meta = indice.unidades.find(u => u.numero === x.unidad);
    const pct = Math.round(100 * i / sesion.items.length);

    let cuerpo = "";

    if(x.tipo === "elegir"){
      cuerpo = '<p class="enunciado">' + esc(it.prompt) + '</p><div class="opciones">' +
        it.opciones.map(op => '<button class="opcion" data-v="' + esc(op) + '">' +
          esc(op) + '</button>').join("") + '</div>';
    }
    else if(x.tipo === "ordenar"){
      cuerpo = '<div class="armado" id="armado"></div>' +
        '<div class="fichas">' + it.palabras.map((p, k) =>
          '<button class="ficha" data-k="' + k + '">' + esc(p) + '</button>').join("") +
        '</div><button class="btn sec chico" id="borrar">Borrar</button>';
    }
    else if(x.tipo === "corregir"){
      cuerpo = '<div class="mal-frase">' + esc(it.mal) + '</div>' +
        (it.pista ? '<p class="pista">' + esc(it.pista) + '</p>' : '') +
        '<input class="respuesta" id="resp" autocomplete="off" autocapitalize="off" ' +
        'spellcheck="false" placeholder="Escríbela bien">';
    }
    else if(x.tipo === "traducir"){
      cuerpo = '<p class="enunciado es">' + esc(it.es) + '</p>' +
        '<input class="respuesta" id="resp" autocomplete="off" autocapitalize="off" ' +
        'spellcheck="false" placeholder="En inglés">';
    }
    else { // completar, transformar
      cuerpo = '<p class="enunciado">' + esc(it.prompt) + '</p>' +
        '<input class="respuesta" id="resp" autocomplete="off" autocapitalize="off" ' +
        'spellcheck="false" placeholder="Tu respuesta">';
    }

    destino.innerHTML =
      '<div class="practica">' +
        '<div class="barra-sesion"><i style="width:' + pct + '%"></i></div>' +
        '<div class="cabeza-item">' +
          '<span class="paso">' + (i + 1) + ' de ' + sesion.items.length + '</span>' +
          '<span class="origen-item">Unidad ' + x.unidad + ' · ' +
            esc(meta ? meta.titulo : "") + '</span>' +
        '</div>' +
        '<div class="tarjeta-ej">' +
          '<div class="tipo-ej">' + (ETIQUETA[x.tipo] || "") + '</div>' +
          '<p class="instr">' + esc(x.instruccion) + '</p>' +
          cuerpo +
          '<div class="veredicto" hidden></div>' +
        '</div>' +
        '<div class="acciones-ej">' +
          '<button class="btn" id="revisar">Revisar</button>' +
          '<button class="btn sec" id="saltar">Saltar</button>' +
        '</div>' +
      '</div>';

    engancharEntrada(x);
  }

  /* --- interacción de cada tipo --- */
  function engancharEntrada(x){
    const inp = destino.querySelector("#resp");
    if(inp){
      inp.focus();
      inp.addEventListener("keydown", e => {
        if(e.key === "Enter") destino.querySelector("#revisar").click();
      });
    }

    if(x.tipo === "elegir"){
      destino.querySelectorAll(".opcion").forEach(b => {
        b.onclick = () => {
          destino.querySelectorAll(".opcion").forEach(o => o.classList.remove("elegida"));
          b.classList.add("elegida");
        };
      });
    }

    if(x.tipo === "ordenar"){
      const armado = destino.querySelector("#armado");
      const puestas = [];
      const repintar = () => {
        if(!puestas.length){
          armado.innerHTML = '<span class="vacio-armado">Toca las palabras en orden</span>';
          return;
        }
        // la puntuación suelta se pega a la palabra anterior
        armado.innerHTML = puestas.map((p, k) => {
          const pega = /^[.,!?;:]+$/.test(p.txt.trim());
          return '<span' + (pega && k ? ' class="pegada"' : '') + '>' + esc(p.txt) + '</span>';
        }).join("");
      };
      destino.querySelectorAll(".ficha").forEach(f => {
        f.onclick = () => {
          if(f.classList.contains("usada")) return;
          f.classList.add("usada");
          puestas.push({txt: f.textContent, el: f});
          repintar();
        };
      });
      destino.querySelector("#borrar").onclick = () => {
        puestas.forEach(p => p.el.classList.remove("usada"));
        puestas.length = 0;
        repintar();
      };
      destino._leer = () => puestas.map(p => p.txt).join(" ");
      repintar();
    }

    destino.querySelector("#revisar").onclick = () => revisar(x);
    destino.querySelector("#saltar").onclick = () => {
      programar(x.clave, "ejercicio", false);
      fallos++; fallados.push(x);
      i++; pintar();
    };
  }

  function leerRespuesta(x){
    if(x.tipo === "elegir"){
      const s = destino.querySelector(".opcion.elegida");
      return s ? s.dataset.v : "";
    }
    if(x.tipo === "ordenar") return destino._leer ? destino._leer() : "";
    const inp = destino.querySelector("#resp");
    return inp ? inp.value.trim() : "";
  }

  /* --- corrección --- */
  async function revisar(x){
    const dado = leerRespuesta(x);
    if(!dado){
      const v = destino.querySelector(".veredicto");
      v.hidden = false;
      v.className = "veredicto neutro";
      v.textContent = "Escribe o elige algo antes de revisar.";
      return;
    }

    const btn = destino.querySelector("#revisar");
    btn.disabled = true;

    if(x.ia){
      return revisarConIA(x, dado, btn);
    }

    const bien = acierta(dado, x.item);
    resolver(x, bien, bien ? null : esperada(x.item), dado);
  }

  function esperada(it){
    return it.respuesta;
  }

  async function revisarConIA(x, dado, btn){
    const v = destino.querySelector(".veredicto");
    v.hidden = false;
    v.className = "veredicto neutro";
    v.textContent = "Revisando tu respuesta...";

    try {
      const r = await fetch("/api/corregir", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          modo: "normal",
          instruccion: x.instruccion,
          prompt: x.item.es,
          esperada: x.item.referencia,
          dada: dado
        })
      });
      const j = await r.json();
      if(j.error) throw new Error(j.error);
      resolver(x, !!j.correcto, x.item.referencia, dado, j.explicacion);
    } catch(e){
      // sin servidor se cae a la comparación local contra la referencia
      const bien = normalizar(dado) === normalizar(x.item.referencia);
      resolver(x, bien, x.item.referencia, dado,
        "La corrección con IA no está disponible, así que se comparó con la frase de referencia.");
    }
  }

  function resolver(x, bien, correcta, dado, nota){
    programar(x.clave, "ejercicio", bien);
    if(bien) aciertos++; else { fallos++; fallados.push(x); }

    // marcar visualmente lo elegido
    if(x.tipo === "elegir"){
      const s = destino.querySelector(".opcion.elegida");
      if(s){ s.classList.remove("elegida"); s.classList.add(bien ? "ok" : "mal"); }
      if(!bien){
        destino.querySelectorAll(".opcion").forEach(b => {
          if(normalizar(b.dataset.v) === normalizar(x.item.respuesta)) b.classList.add("ok");
        });
      }
    }
    const inp = destino.querySelector("#resp");
    if(inp){ inp.classList.add(bien ? "ok" : "mal"); inp.disabled = true; }

    const v = destino.querySelector(".veredicto");
    v.hidden = false;
    v.className = "veredicto " + (bien ? "ok" : "mal");
    v.innerHTML = '<b>' + (bien ? "Correcto" : "No es esa") + '</b>' +
      (!bien && correcta ? '<div class="correcta">' + esc(correcta) + '</div>' : "") +
      (nota ? '<div class="nota-ia">' + esc(nota) + '</div>' : "");

    const acc = destino.querySelector(".acciones-ej");
    acc.innerHTML = '<button class="btn" id="seguir">' +
      (i + 1 >= sesion.items.length ? "Ver resultado" : "Siguiente") + '</button>';
    const seguir = destino.querySelector("#seguir");
    seguir.focus();
    seguir.onclick = () => { i++; pintar(); };
    document.onkeydown = e => {
      if(e.key === "Enter" && destino.querySelector("#seguir")){
        e.preventDefault();
        destino.querySelector("#seguir").click();
      }
    };
  }

  /* --- final --- */
  function final(){
    document.onkeydown = null;
    const total = aciertos + fallos;
    const pct = total ? Math.round(100 * aciertos / total) : 0;

    let h = '<div class="practica"><div class="final">' +
      '<div class="marcador"><div class="v">' + aciertos + '<span>/' + total + '</span></div>' +
      '<div class="k">' + (pct >= 80 ? "Buena tanda" : pct >= 50 ? "Se puede mejorar" : "Conviene releer la unidad") +
      '</div></div>';

    if(fallados.length){
      const porUnidad = new Map();
      fallados.forEach(x => porUnidad.set(x.unidad, (porUnidad.get(x.unidad) || 0) + 1));
      h += '<p class="repaso-sug">Lo que falló vuelve mañana. Los errores se concentraron en ' +
        [...porUnidad.entries()].map(([u, n]) => 'la unidad ' + u + ' (' + n + ')').join(" y ") +
        '.</p>';
    } else if(total){
      h += '<p class="repaso-sug">Sin errores. Estos ítems vuelven a aparecer más adelante, ' +
        'cada vez más espaciados.</p>';
    }

    h += '<div class="acciones-ej">' +
      '<button class="btn" id="otra">Otra tanda</button>' +
      '<button class="btn sec" id="volver-ej">Volver</button></div></div></div>';

    destino.innerHTML = h;
    destino.querySelector("#otra").onclick = () => o.alRepetir && o.alRepetir();
    destino.querySelector("#volver-ej").onclick = () => o.alSalir && o.alSalir();
  }

  pintar();
}
