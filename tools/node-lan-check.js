const http = require('http');

const host = '0.0.0.0';
const port = 30123;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('node-lan-check-ok');
});

server.listen(port, host, () => {
  console.log(`Node LAN check listening on http://${host}:${port}`);
});
