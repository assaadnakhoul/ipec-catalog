// netlify/functions/catalog.js
const SHEET_ID = "152mQvHjOt10oRIsV6oWfhKTSSBI_HR_n";
const GID = "1735709978";

let cache = { t: 0, json: null };
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function parseCSV(text) {
  const out = [], row = [];
  let f = "", q = false;
  const push = () => { out.push(row.slice()); row.length = 0; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i+1];
    if (q) {
      if (c === '"') { if (n === '"') { f += '"'; i++; } else { q = false; } }
      else { f += c; }
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ""; }
      else if (c === '\n') { row.push(f); f = ""; push(); }
      else if (c !== '\r') { f += c; }
    }
  }
  row.push(f); push();
  return out;
}

exports.handler = async () => {
  try {
    if (cache.json && (Date.now() - cache.t) < TTL_MS) {
      return {
        statusCode: 200,
        headers: { "content-type":"application/json", "cache-control":"public, max-age=300, s-maxage=300" },
        body: JSON.stringify(cache.json)
      };
    }
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
    const res = await fetch(url, { redirect:"follow" });
    if (!res.ok) throw new Error(`Sheets HTTP ${res.status}`);
    const csv = await res.text();
    const arr = parseCSV(csv);

    const heads = (arr[0]||[]).map(h => String(h||'').trim().toLowerCase());
    const find = (alts, def) => { for (const a of alts){ const i=heads.findIndex(h=>h.includes(a)); if(i>=0) return i; } return def; };

    const codeIdx = find(['ref','code','item code','reference'], 0);
    const descIdx = find(['description','desc'], 1);
    const catIdx  = find(['category','cat'], 3);        // D
    const subIdx  = find(['sub','sub category','subcategory'], 4); // E
    const linkIdx = find(['spec url','datasheet','link','datasheet url','spec'], 7); // H

    const json = arr.slice(1).map(r => ({
      code:(r[codeIdx]||'').toString().trim(),
      desc:(r[descIdx]||'').toString().trim(),
      cat:(r[catIdx]||'').toString().trim(),
      sub:(r[subIdx]||'').toString().trim(),
      link:(linkIdx>=0 ? (r[linkIdx]||'').toString().trim() : null)
    })).filter(x => x.code);

    cache = { t: Date.now(), json };
    return {
      statusCode: 200,
      headers: { "content-type":"application/json", "cache-control":"public, max-age=300, s-maxage=300" },
      body: JSON.stringify(json)
    };
  } catch (e) {
    return { statusCode: 500, body: `Error: ${e.message}` };
  }
};
