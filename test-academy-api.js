/**
 * Test script to verify Academy API endpoints
 * Run with: node test-academy-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const ENDPOINTS = [
  { method: 'GET', path: '/api/admin/academy-sections', name: 'GET Academy Sections' },
  { method: 'POST', path: '/api/admin/academy-sections', name: 'CREATE Academy Section', body: { title: 'Test', description: 'Test Description', icon_emoji: '🎓', is_active: 1, order: 99 } },
  { method: 'PUT', path: '/api/admin/academy-sections/1', name: 'UPDATE Academy Section', body: { title: 'Updated Test', description: 'Updated Desc' } },
  { method: 'DELETE', path: '/api/admin/academy-sections/1', name: 'DELETE Academy Section' }
];

async function testEndpoint(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body && (method === 'POST' || method === 'PUT')) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Academy API Endpoints\n');
  console.log('Base URL:', BASE_URL);
  console.log('====================================\n');

  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`📤 ${endpoint.method} ${endpoint.path}`);
      const result = await testEndpoint(endpoint.method, endpoint.path, endpoint.body);
      console.log(`✅ Status: ${result.status}`);
      console.log(`Response:`, JSON.stringify(result.body, null, 2));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log('------------------------------------\n');
  }
}

runTests().catch(console.error);
