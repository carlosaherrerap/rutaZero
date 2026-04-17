const http = require('http');
const body = JSON.stringify({ username: 'admin', password: 'rutazero123' });
const req = http.request({
  hostname: 'localhost', port: 4000, path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { const j = JSON.parse(data); console.log(j.token ? 'LOGIN OK - token recibido ✅' : JSON.stringify(j)); }
    catch { console.log(data); }
  });
});
req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();

