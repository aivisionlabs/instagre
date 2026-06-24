const URL = 'https://gpsiktnanghdvjslqdtd.supabase.co/rest/v1/words';
const KEY = 'sb_publishable_BxcQhq6IwkJdAKlE8y6D_g_fCA-Lmi7';
const headers = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  Prefer: 'count=exact',
};

async function fetchPage(from, to) {
  const res = await fetch(`${URL}?select=word&order=sort_order.asc`, {
    headers: { ...headers, Range: `${from}-${to}` },
  });
  const contentRange = res.headers.get('content-range') || '';
  const rows = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(rows));
  return { rows, contentRange };
}

let all = [];
let from = 0;
const pageSize = 1000;
while (true) {
  const { rows, contentRange } = await fetchPage(from, from + pageSize - 1);
  all = all.concat(rows);
  const m = contentRange.match(/\/(\d+)$/);
  const total = m ? Number(m[1]) : all.length;
  console.error('fetched', all.length, '/', total, contentRange);
  if (rows.length < pageSize || all.length >= total) break;
  from += pageSize;
}

const counts = {};
for (const r of all) {
  const L = r.word[0].toUpperCase();
  counts[L] = (counts[L] || 0) + 1;
}
console.log('Total words in DB (anon key):', all.length);
for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const n = counts[L] || 0;
  const locked = !['A', 'B', 'C', 'D'].includes(L) && n === 0;
  console.log(L, n, locked ? 'LOCKED on homepage' : 'unlocked');
}
