const http = require('http');

const options = {
  hostname: '127.0.0.1',  // Use IPv4 explicitly instead of localhost
  port: 3000,
  path: '/api/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.log('ERROR', err);
  process.exit(1);
});

request.on('timeout', () => {
  console.log('TIMEOUT');
  request.abort();
  process.exit(1);
});

request.end();