// api/corregir.js
// Funcion serverless de Vercel. La API key vive en el servidor, nunca en el navegador.
// Configurar en Vercel: Settings -> Environment Variables -> ANTHROPIC_API_KEY

const MODELO = "claude-sonnet-5";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en el servidor" });
  }

  const { modo, instruccion, prompt, esperada, dada, validas } = req.body || {};

  let tarea;
  if (modo === "produccion") {
    tarea = `El estudiante debe formar oraciones correctas en ingles usando una tabla del libro.
Las oraciones que el libro considera validas son:
${(validas || []).map(v => "- " + v).join("\n")}

El estudiante escribio: "${dada}"

Decide si su oracion es gramaticalmente correcta Y consistente con el patron de la tabla.
Acepta variaciones razonables (contracciones, orden natural) aunque no esten literales en la lista.`;
  } else {
    tarea = `Ejercicio: ${instruccion || "(sin instruccion)"}
Enunciado: ${prompt || ""}
Respuesta del libro: "${esperada}"
Respuesta del estudiante: "${dada}"

Decide si la respuesta del estudiante es aceptable. Es aceptable si es gramaticalmente
correcta y significa lo mismo que la del libro, aunque no sea identica (contracciones,
sinonimos validos, mayusculas o puntuacion distintas).`;
  }

  const sistema = `Eres un profesor de ingles corrigiendo a un hispanohablante.
Responde SOLO con un objeto JSON, sin markdown ni texto alrededor:
{"correcto": true|false, "explicacion": "una o dos frases en espanol"}

Si es correcto, la explicacion confirma brevemente y, si aporta, senala un matiz.
Si es incorrecto, explica el error concreto en espanol y da la forma correcta.
No seas condescendiente ni uses relleno.`;

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
        max_tokens: 400,
        system: sistema,
        messages: [{ role: "user", content: tarea }],
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

    let salida;
    try {
      salida = JSON.parse(texto);
    } catch (e) {
      salida = { correcto: null, explicacion: texto.slice(0, 300) };
    }

    return res.status(200).json(salida);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
