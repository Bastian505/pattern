// js/contenido.js
// Carga el temario. El índice trae solo los títulos; cada unidad se baja
// cuando se abre, y queda en memoria para no pedirla dos veces.

const RUTA = "contenido/a1/";
const cache = new Map();

export let indice = null;

export async function cargarIndice(){
  const r = await fetch(RUTA + "indice.json", {cache: "no-cache"});
  if(!r.ok) throw new Error("No se pudo cargar el índice del temario");
  indice = await r.json();
  return indice;
}

export async function cargarUnidad(numero){
  if(cache.has(numero)) return cache.get(numero);
  const meta = indice.unidades.find(u => u.numero === numero);
  if(!meta) throw new Error("Unidad " + numero + " no existe");
  const r = await fetch(RUTA + meta.archivo, {cache: "no-cache"});
  if(!r.ok) throw new Error("No se pudo cargar la unidad " + numero);
  const u = await r.json();
  cache.set(numero, u);
  return u;
}

const cacheEj = new Map();

/* Los ejercicios de una unidad viven en su propio archivo y solo se
   bajan cuando se va a practicar esa unidad. */
export async function cargarEjercicios(numero){
  if(cacheEj.has(numero)) return cacheEj.get(numero);
  const meta = indice.unidades.find(u => u.numero === numero);
  if(!meta || !meta.ejercicios) return null;
  const r = await fetch(RUTA + "ejercicios/" + meta.archivo, {cache: "no-cache"});
  if(!r.ok) return null;
  const e = await r.json();
  cacheEj.set(numero, e);
  return e;
}

export function nombreBloque(n){
  const b = (indice.bloques || []).find(x => x.numero === n);
  return b ? b.titulo : "";
}

/* Clave de progreso de una unidad leída: activa sus ejercicios. */
export function claveUnidad(n){ return "a1:u" + n + ":leida"; }

/* Clave de un ítem suelto, para el repaso espaciado. */
export function claveItem(unidad, tanda, i){
  return "a1:u" + unidad + ":" + tanda + ":" + i;
}
