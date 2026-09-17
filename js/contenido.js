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

export function nombreBloque(n){
  const b = (indice.bloques || []).find(x => x.numero === n);
  return b ? b.titulo : "";
}

/* Clave de progreso de una unidad leída. Cuando existan ejercicios,
   cada uno tendrá la suya y esta pasará a ser solo el resumen. */
export function claveUnidad(n){ return "a1:u" + n + ":leida"; }
