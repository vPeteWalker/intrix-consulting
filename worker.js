const ADMIN_PASSWORD = "intrix2026!";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Admin dashboard
    if (url.pathname === '/admin') {
      const auth = request.headers.get('Authorization');
      const expected = 'Basic ' + btoa('admin:' + ADMIN_PASSWORD);

      if (auth !== expected) {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Intrix Admin"' }
        });
      }

      const keys = await env.SUBMISSIONS.list();
      const submissions = [];

      for (const key of keys.keys) {
        const val = await env.SUBMISSIONS.get(key.name);
        if (val) submissions.push(JSON.parse(val));
      }

      submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intrix - Contact Submissions</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, sans-serif; background:#080c14; color:#e8edf5; padding:2rem; }
  h1 { font-size:1.5rem; margin-bottom:0.25rem; color:#00c8ff; }
  .subtitle { color:#7a8a9e; font-size:0.85rem; margin-bottom:2rem; }
  .count { display:inline-block; background:rgba(0,200,255,0.1); border:1px solid rgba(0,200,255,0.3); border-radius:100px; padding:0.2rem 0.75rem; font-size:0.78rem; color:#00c8ff; margin-bottom:2rem; }
  .card { background:#0d1420; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:1.5rem; margin-bottom:1rem; }
  .card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem; }
  .name { font-size:1.05rem; font-weight:600; }
  .badge { font-size:0.72rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; padding:0.25rem 0.75rem; border-radius:100px; }
  .badge-home { background:rgba(0,200,255,0.1); border:1px solid rgba(0,200,255,0.3); color:#00c8ff; }
  .badge-biz { background:rgba(0,102,255,0.15); border:1px solid rgba(0,102,255,0.4); color:#6699ff; }
  .meta { display:flex; gap:1.5rem; flex-wrap:wrap; margin-bottom:1rem; }
  .meta span { font-size:0.85rem; color:#7a8a9e; }
  .meta a { color:#00c8ff; text-decoration:none; }
  .meta a:hover { text-decoration:underline; }
  .field { margin-bottom:0.75rem; }
  .field label { font-size:0.72rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#7a8a9e; display:block; margin-bottom:0.25rem; }
  .field p { font-size:0.9rem; line-height:1.6; color:#e8edf5; }
  .timestamp { font-size:0.78rem; color:#7a8a9e; margin-top:1rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.05); }
  .empty { text-align:center; padding:4rem; color:#7a8a9e; }
</style>
</head>
<body>
<h1>Intrix. Contact Submissions</h1>
<p class="subtitle">Stored securely in Cloudflare KV</p>
<span class="count">${submissions.length} submission${submissions.length !== 1 ? 's' : ''}</span>
${submissions.length === 0 ? '<div class="empty">No submissions yet.</div>' : submissions.map(s => `
<div class="card">
  <div class="card-header">
    <span class="name">${s.firstName} ${s.lastName}</span>
    <span class="badge ${s.type === 'business' ? 'badge-biz' : 'badge-home'}">${s.type === 'business' ? 'Business Advisory' : 'Home Concierge'}</span>
  </div>
  <div class="meta">
    <span>✉️ <a href="mailto:${s.email}">${s.email}</a></span>
    ${s.company ? `<span>🏢 ${s.company}</span>` : ''}
    ${s.service ? `<span>🎯 ${s.service}</span>` : ''}
  </div>
  ${s.message ? `<div class="field"><label>Message</label><p>${s.message.replace(/\n/g, '<br>')}</p></div>` : ''}
  <div class="timestamp">Received: ${new Date(s.timestamp).toLocaleString('en-US', { dateStyle:'full', timeStyle:'short' })}</div>
</div>`).join('')}
</body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Form submission endpoint
    if (url.pathname === '/submit' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { firstName, lastName, email, company, service, message, type } = data;

        if (!firstName || !lastName || !email || !message) {
          return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7);
        const submission = {
          id,
          timestamp: new Date().toISOString(),
          type: type || 'home',
          firstName, lastName, email,
          company: company || null,
          service: service || null,
          message
        };

        await env.SUBMISSIONS.put(id, JSON.stringify(submission));

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
