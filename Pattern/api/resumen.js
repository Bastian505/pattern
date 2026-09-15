// api/resumen.js
// Genera la lamina de resumen en espanol de una unidad, a partir del
// contenido extraido del libro. Se llama una sola vez por unidad:
// la app guarda el resultado y despues lo lee de su propia base.

const MODELO = "claude-sonnet-5";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en el servidor" });

  const { titulo, explicaciones, ejemplos, vocabulario } = req.body || {};

  const material = `TITULO DE LA UNIDAD: ${titulo || "(sin titulo)"}

EXPLICACIONES DEL LIBRO:
${(explicaciones || []).map(e =>
  `- ${e.titulo || ""}: ${e.texto || ""}`).join("\n")}

EJEMPLOS EN INGLES QUE APARECEN EN LA UNIDAD:
${(ejemplos || []).slice(0, 25).map(x => "- " + x).join("\n")}

VOCABULARIO DE LA UNIDAD:
${(vocabulario || []).slice(0, 30).join(", ")}`;

  const sistema = `Eres un profesor de ingles que ensena a hispanohablantes principiantes.
Te dan el contenido de una unidad de un libro de texto, en ingles, y produces
una ficha de repaso EN ESPANOL.

Responde SOLO con un objeto JSON, sin markdown ni texto alrededor:

{
  "concepto": {
    "puntos": ["2 a 4 frases cortas que expliquen de que se trata el tema"],
    "clave": "una frase que resuma como pensar el tema, en lenguaje simple"
  },
  "estructura": {
    "filas": [
      {"etiqueta": "Afirmativo", "formula": "Sujeto + am/is/are + complemento"}
    ],
    "notas": ["1 a 3 notas cortas sobre como cambia la forma"]
  },
  "ejemplos": [
    {"en": "I am ready.", "es": "Estoy listo."}
  ],
  "ojo": {
    "puntos": ["1 a 3 advertencias sobre errores tipicos de hispanohablantes"],
    "mal": "una oracion incorrecta que suelen decir los hispanohablantes",
    "bien": "la misma oracion corregida"
  }
}

Reglas:
- Todo el texto explicativo va en espanol. Solo las oraciones de ejemplo van en ingles.
- Usa los ejemplos reales de la unidad cuando sirvan; puedes agregar alguno propio si falta.
- Entre 4 y 6 ejemplos, con su traduccion natural al espanol (no literal).
- "estructura": si el tema no tiene formulas (por ejemplo una unidad de vocabulario),
  usa filas que muestren el patron de uso, o deja "filas" vacio y explica en "notas".
- Se concreto y breve. Nada de relleno ni de felicitaciones.
- Piensa en alguien que no sabe ingles: no uses terminologia gramatical sin explicarla.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2000,
        system: sistema,
        messages: [{ role: "user", content: material }],
      }),
    });

    if (!r.ok) {
      const detalle = await r.text();
      return res.status(502).json({ error: "La API respondio " + r.status, detalle });
    }

    const data = await r.json();
    const texto = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    try {
      return res.status(200).json(JSON.parse(texto));
    } catch (e) {
      return res.status(502).json({ error: "La respuesta no vino en el formato esperado" });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
