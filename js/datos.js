// js/datos.js
// Sesión, progreso y sincronización. Todo lo que toca Supabase vive aquí.

export const SUPABASE_URL  = "https://upyyigfqefydzisqkjac.supabase.co";
export const SUPABASE_ANON = "sb_publishable_jAVf0BlZ4IAyZv7wT2N8yQ_kUzSLy4l";

const CLAVE_LOCAL = "pattern-progreso-v1";
export const ESCALONES = [1, 3, 7, 16, 35, 90];   // días hasta el próximo repaso

export const estado = {
  usuario: null,
  progreso: {},
  sb: null,
};

let avisar = () => {};
export function alSincronizar(fn){ avisar = fn; }

export async function iniciarSupabase(){
  if(!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    estado.sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    return estado.sb;
  } catch(e){
    // Sin red o con el CDN caído la app sigue funcionando contra el navegador.
    console.warn("Supabase no disponible, se trabaja solo en local:", e);
    estado.sb = null;
    return null;
  }
}

/* ---------------- almacenamiento local ---------------- */
export function cargarLocal(){
  try { estado.progreso = JSON.parse(localStorage.getItem(CLAVE_LOCAL)) || {}; }
  catch(e){ estado.progreso = {}; }
}
function guardarLocal(){
  try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(estado.progreso)); } catch(e){}
}

/* ---------------- registros ---------------- */
export function registro(clave, tipo){
  if(!estado.progreso[clave]){
    estado.progreso[clave] = {tipo, ok:false, intentos:0, aciertos:0, nivel:0, proxima:null, datos:null};
  }
  return estado.progreso[clave];
}

export function hoy(){ return new Date().toISOString().slice(0,10); }
export function sumarDias(d){
  const f = new Date();
  f.setDate(f.getDate() + d);
  return f.toISOString().slice(0,10);
}

/* Avanza o retrocede el escalón de repaso según el resultado. */
export function programar(clave, tipo, acerto){
  const r = registro(clave, tipo);
  r.intentos++;
  if(acerto){
    r.aciertos++;
    r.ok = true;
    r.nivel = Math.min(r.nivel + 1, ESCALONES.length);
  } else {
    r.ok = false;
    r.nivel = Math.max(r.nivel - 1, 0);
  }
  r.proxima = sumarDias(ESCALONES[Math.max(r.nivel - 1, 0)]);
  subir(clave);
  return r;
}

/* Marca simple, sin repaso (por ahora: unidad leída). */
export function marcar(clave, tipo, valor){
  const r = registro(clave, tipo);
  r.ok = !!valor;
  r.proxima = valor ? sumarDias(ESCALONES[0]) : null;
  if(valor) r.nivel = Math.max(r.nivel, 1);
  subir(clave);
  return r;
}

/* ---------------- sincronización ---------------- */
export async function subir(clave){
  guardarLocal();
  if(!estado.usuario || !estado.sb) return;
  const r = estado.progreso[clave];
  try {
    const {error} = await estado.sb.from("progreso").upsert({
      user_id: estado.usuario.id, clave, tipo: r.tipo, ok: r.ok,
      intentos: r.intentos, aciertos: r.aciertos, nivel: r.nivel,
      proxima: r.proxima, datos: r.datos, actualizado: new Date().toISOString()
    });
    avisar(error ? "no se pudo guardar: " + error.message : "guardado", !!error);
  } catch(e){
    avisar("sin conexión, guardado solo aquí", true);
  }
}

export async function subirTodo(){
  if(!estado.usuario || !estado.sb) return;
  const filas = Object.keys(estado.progreso).map(clave => {
    const r = estado.progreso[clave];
    return {user_id: estado.usuario.id, clave, tipo: r.tipo, ok: r.ok,
            intentos: r.intentos, aciertos: r.aciertos, nivel: r.nivel,
            proxima: r.proxima, datos: r.datos, actualizado: new Date().toISOString()};
  });
  if(!filas.length) return;
  const {error} = await estado.sb.from("progreso").upsert(filas);
  avisar(error ? "no se pudo sincronizar: " + error.message
               : filas.length + " registros sincronizados", !!error);
}

export async function bajar(){
  if(!estado.usuario || !estado.sb) return;
  const {data, error} = await estado.sb.from("progreso").select("*").eq("user_id", estado.usuario.id);
  if(error){ avisar("no se pudo leer: " + error.message, true); return; }
  (data || []).forEach(f => {
    estado.progreso[f.clave] = {
      tipo:f.tipo, ok:f.ok, intentos:f.intentos, aciertos:f.aciertos,
      nivel:f.nivel, proxima:f.proxima, datos:f.datos
    };
  });
  guardarLocal();
}
