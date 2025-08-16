// server.js — één bestand voor backend + frontend // Starten: 1) npm init -y  2) npm i express openai cors  3) zet OPENAI_API_KEY in je env  4) node server.js // Bezoek: http://localhost:3000

import express from 'express'; import cors from 'cors'; import OpenAI from 'openai';

const app = express(); app.use(cors()); app.use(express.json({ limit: '1mb' }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Vertaal-API --- app.post('/api/translate', async (req, res) => { try { const { text, mode = 'arabic' } = req.body || {}; if (!text || typeof text !== 'string' || !text.trim()) { return res.status(400).json({ error: 'Vraag: stuur { text: "..." }' }); }

// Instructies voor consequente Levantijns-Syrisch (Shami/Syrian) output
const instructions = `You are a professional translator.

Translate any English or Dutch input into Levantine Syrian Arabic (Shami — Syrian dialect). Rules:

1. Output in Arabic script (no Latin) unless explicitly asked.


2. Preserve meaning, tone, style, emojis, formatting, line breaks and markdown.


3. Prefer common Syrian vocabulary over formal MSA.


4. Do not add explanations; return only the translation text.


5. If input is already Arabic (Levantine or MSA), return it unchanged.


6. Examples of dialect choices: car→سيارة, bus→باص, okay→تمام, thanks→يسلمو, what’s up?→شو الأخبار؟


7. Numbers and proper nouns stay as in the source when appropriate.`;

// Wanneer de gebruiker beide (Arabisch + transliteratie) wil const wantBoth = mode === 'both';

// Maak de prompt; we sturen expliciete taak + originele tekst const userInput = wantBoth ? `Translate to Levantine Syrian Arabic. Return two sections: [Arabic]: the translation in Arabic script only. [Transliteration]: a simple phonetic Latin transliteration suitable for learners.



Text: ${text}:Translate to Levantine Syrian Arabic (Arabic script only). Text:\n${text}`;

const response = await client.responses.create({
  model: 'gpt-4o-mini',
  instructions,
  input: userInput,
  temperature: 0.2,
});

const output = response.output_text || '';

if (wantBoth) {
  // Probeer secties te parsen
  const arabic = (output.match(/Arabic[\s\S]*?\n([\s\S]*)\nTransliteration/i)?.[1] ||
    output.match(/Arabic:?\s*([\s\S]*?)\n/i)?.[1] ||
    '').trim();
  const translit = (output.match(/\[Transliteration[\s\S]*?\n([\s\S]*)$/i)?.[1] ||
    output.match(/Transliteration:?\s*([\s\S]*)$/i)?.[1] ||
    '').trim();
  return res.json({ translation: arabic || output.trim(), transliteration: translit });
} else {
  return res.json({ translation: output.trim() });
}

} catch (err) { console.error(err); const msg = err?.response?.data?.error?.message || err.message || 'Onbekende fout'; res.status(500).json({ error: msg }); } });

// --- Eenvoudige front-end in 1 bestand --- app.get('/', (_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html>

<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Levantra — EN/NL → Levantijns-Syrisch Arabisch</title>
  <script>
    // Kleine helper voor copy
    function copy(id){
      const el = document.getElementById(id);
      navigator.clipboard.writeText(el.innerText).then(()=>{
        const btn = document.getElementById(id+'-btn');
        const old = btn.innerText; btn.innerText = 'Gekopieerd!';
        setTimeout(()=>btn.innerText=old, 1200);
      });
    }
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900">
  <div class="max-w-3xl mx-auto p-6">
    <header class="mb-6">
      <h1 class="text-2xl md:text-3xl font-bold">Levantra <span class="text-slate-500 text-lg">— EN/NL → Levantijns‑Syrisch Arabisch</span></h1>
      <p class="text-sm text-slate-600 mt-1">Voer Engelse of Nederlandse tekst in. De vertaler geeft Syrisch‑Levantijns Arabisch terug. 
      <span class="font-medium">API‑sleutel staat op de server</span> — veilig dus.</p>
    </header><main class="space-y-4">
  <textarea id="src" rows="6" class="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400" placeholder="Typ hier je tekst…"></textarea>

  <div class="flex items-center gap-3">
    <label class="inline-flex items-center gap-2 text-sm">
      <input id="mode" type="checkbox" class="h-4 w-4"> 
      Toon ook transliteratie (Latijnse weergave)
    </label>
    <button id="go" class="ml-auto px-4 py-2 rounded-2xl shadow bg-slate-900 text-white hover:bg-slate-800">Vertalen</button>
  </div>

  <section class="grid gap-4">
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="flex items-center gap-2 mb-2">
        <h2 class="font-semibold">Vertaling (Arabisch)</h2>
        <button id="out-btn" onclick="copy('out')" class="ml-auto text-xs px-2 py-1 rounded-xl border">Kopieer</button>
      </div>
      <div id="out" dir="rtl" class="leading-8 text-xl break-words"></div>
    </div>
    <div id="translit-wrap" class="hidden rounded-2xl border border-slate-200 bg-white p-4">
      <div class="flex items-center gap-2 mb-2">
        <h2 class="font-semibold">Transliteratie</h2>
        <button id="translit-btn" onclick="copy('translit')" class="ml-auto text-xs px-2 py-1 rounded-xl border">Kopieer</button>
      </div>
      <div id="translit" class="leading-7 text-base break-words"></div>
    </div>
  </section>
</main>

<footer class="mt-10 text-xs text-slate-500">Gemaakt met OpenAI. Houd rekening met context en nuances: controleer belangrijke vertalingen handmatig.</footer>

  </div>  <script>
    const go = document.getElementById('go');
    const src = document.getElementById('src');
    const out = document.getElementById('out');
    const translit = document.getElementById('translit');
    const translitWrap = document.getElementById('translit-wrap');
    const modeBox = document.getElementById('mode');

    async function translate() {
      const text = src.value.trim();
      if (!text) return;
      out.innerText = 'Vertalen…';
      translit.innerText = '';
      translitWrap.classList.add('hidden');
      const mode = modeBox.checked ? 'both' : 'arabic';

      try {
        const r = await fetch('/api/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, mode })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Vertalen mislukt');
        out.innerText = data.translation || '';
        if (data.transliteration) {
          translit.innerText = data.transliteration;
          translitWrap.classList.remove('hidden');
        }
      } catch (e) {
        out.innerText = 'Fout: ' + (e.message || 'onbekend');
      }
    }

    go.addEventListener('click', translate);
    src.addEventListener('keydown', (ev)=>{ if (ev.metaKey && ev.key === 'Enter') translate(); });
  </script></body>
</html>`);
});const PORT = process.env.PORT || 3000; app.listen(PORT, () => console.log(Levantra draait op http://localhost:${PORT}));

