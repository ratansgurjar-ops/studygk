const http = require('http');
http.get('http://localhost:4000/api/questions/meta', res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log(res.statusCode + ' -- ' + b);
  });
}).on('error', e => { console.error('err', e.message); process.exit(1); });
