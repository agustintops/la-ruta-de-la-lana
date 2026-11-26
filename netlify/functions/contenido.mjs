// Lee el contenido del juego desde la planilla de Google y lo entrega como JSON.
// Necesita la variable de entorno SHEET_ID (el identificador de la planilla).
// La planilla debe estar compartida como "cualquier persona con el enlace puede ver".
const HOJAS = ["Preguntas", "Paradas", "Planta", "Perfiles", "Textos", "Ajustes"];

function csv(texto) {
  const filas = []; let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

async function hoja(id, nombre) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nombre)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo leer la pestaña ${nombre} (${r.status})`);
  const t = await r.text();
  if (t.trimStart().startsWith("<")) throw new Error("La planilla no está compartida para lectura");
  const [cab, ...filas] = csv(t);
  return filas.map((f) => Object.fromEntries(cab.map((k, i) => [k.trim(), (f[i] ?? "").trim()])));
}

const claves = (filas, valor) => Object.fromEntries(filas.filter((f) => f.clave).map((f) => [f.clave, f[valor]]));

export default async () => {
  const id = process.env.SHEET_ID;
  if (!id) return Response.json({ error: "Falta SHEET_ID" }, { status: 500 });
  try {
    const [preg, paradas, planta, perfiles, textos, ajustes] = await Promise.all(HOJAS.map((h) => hoja(id, h)));
    // La pestaña de curiosidades es opcional: si falta o falla, el juego usa las que trae adentro.
    const curios = await hoja(id, "Curiosidades").catch(() => []);
    const conf = claves(ajustes, "valor");
    const borradores = (conf.mostrar_borradores || "").toLowerCase().startsWith("s");
    const preguntas = [];
    for (const p of preg) {
      const estado = (p.estado || "").toLowerCase();
      if (!(estado === "aprobada" || (borradores && estado === "borrador"))) continue;
      const o = [p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d].filter(Boolean);
      const letra = (p.correcta || "").trim().toUpperCase();
      const c = letra.length === 1 ? "ABCD".indexOf(letra) : -1;
      // Las filas incompletas se descartan en vez de romper el juego.
      if (!p.id || !p.categoria || !p.pregunta || o.length < 2 || c < 0 || c >= o.length) continue;
      // Por qué no es cada opción equivocada (alineado con las opciones) y la explicación sencilla para chicos.
      const n = ["a", "b", "c", "d"].filter((l) => p["opcion_" + l]).map((l) => (p["por_que_no_" + l] || "").trim());
      preguntas.push({ id: p.id, cat: p.categoria, t: p.titulo, q: p.pregunta, o, c, e: p.explicacion, f: p.fuente,
        n: n.some(Boolean) ? n : undefined, ec: (p.explicacion_chicos || "").trim() || undefined,
        p: (p.perfiles || "").split(",").map((x) => x.trim()).filter(Boolean) });
    }
    const recorridos = {};
    for (const s of paradas) {
      if (!s.recorrido || !s.nombre || !s.texto || !s.pregunta || !s.opcion_correcta || !s.opcion_incorrecta) continue;
      (recorridos[s.recorrido] ||= []).push({ orden: Number(s.orden) || 0, n: s.nombre, t: s.texto, q: s.pregunta,
        o: [s.opcion_correcta, s.opcion_incorrecta], c: 0, i: s.icono });
    }
    for (const k in recorridos) recorridos[k].sort((a, b) => a.orden - b.orden);
    const curiosidades = [];
    for (const k of curios) {
      const estado = (k.estado || "").toLowerCase();
      if (!(estado === "aprobada" || (borradores && estado === "borrador"))) continue;
      if (!k.estacion || !k.titulo || !k.texto) continue;
      curiosidades.push({ e: k.estacion.toLowerCase(), i: k.icono, t: k.titulo, x: k.texto, f: k.fuente,
        p: (k.perfiles || "").split(",").map((x) => x.trim()).filter(Boolean) });
    }
    return Response.json(
      { preguntas, recorridos, curiosidades, planta: claves(planta, "valor"), textos: claves(textos, "texto"), ajustes: conf,
        perfiles: perfiles.filter((p) => p.clave) },
      // La página pide esta dirección con un sello de tiempo que cambia cada 2 minutos, así nunca queda una copia vieja.
      { headers: { "cache-control": "public, max-age=60", "netlify-cdn-cache-control": "public, max-age=120" } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
};

export const config = { path: "/api/contenido" };
