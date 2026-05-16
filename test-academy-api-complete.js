/**
 * Complete Academy API test with authentication
 * Run with: node test-academy-api-complete.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

async function makeRequest(method, path, body = null, useAuth = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (useAuth && authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
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
  console.log('🧪 Academy API Complete Test Suite\n');
  console.log('Base URL:', BASE_URL);
  console.log('====================================\n');

  // Step 1: Authentication
  console.log('📌 Step 1: Getting authentication token...\n');
  try {
    const loginResult = await makeRequest('POST', '/auth/login', {
      username: 'admin',
      password: 'change_me'
    }, false);

    if (loginResult.status === 200 && loginResult.body.ok && loginResult.body.token) {
      authToken = loginResult.body.token;
      console.log('✅ Authentication successful');
      console.log(`Token: ${authToken.substring(0, 20)}...`);
    } else {
      console.log(`❌ Authentication failed: ${loginResult.status}`);
      console.log('Response:', loginResult.body);
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ Authentication error: ${error.message}`);
    process.exit(1);
  }

  console.log('\n====================================\n');

  // Step 2: Test GET endpoint
  console.log('📌 Step 2: Testing GET /api/admin/academy-sections\n');
  try {
    const getResult = await makeRequest('GET', '/api/admin/academy-sections');
    console.log(`Status: ${getResult.status}`);
    if (getResult.status === 200 && getResult.body.ok) {
      console.log(`✅ Retrieved ${getResult.body.data?.length || 0} sections`);
    } else {
      console.log(`⚠️  Unexpected response:`, getResult.body);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n====================================\n');

  // Step 3: Test POST endpoint (create)
  console.log('📌 Step 3: Testing POST /api/admin/academy-sections (Create)\n');
  let createdId = null;
  try {
    const postData = {
      title: 'Test Academy Section',
      description: 'This is a test section created via API',
      icon_emoji: '🎓',
      is_active: 1,
      order: 999
    };
    console.log('Sending:', JSON.stringify(postData, null, 2));
    const postResult = await makeRequest('POST', '/api/admin/academy-sections', postData);
    console.log(`Status: ${postResult.status}`);
    console.log('Response:', JSON.stringify(postResult.body, null, 2));

    if (postResult.status === 201 && postResult.body.ok) {
      createdId = postResult.body.data?.id;
      console.log(`✅ Section created with ID: ${createdId}`);
    } else {
      console.log(`⚠️  Unexpected response`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n====================================\n');

  // Step 4: Test PUT endpoint (update)
  if (createdId) {
    console.log(`📌 Step 4: Testing PUT /api/admin/academy-sections/${createdId} (Update)\n`);
    try {
      const updateData = {
        title: 'Updated Academy Section Title',
        description: 'This has been updated via the PUT endpoint'
      };
      console.log('Sending:', JSON.stringify(updateData, null, 2));
      const putResult = await makeRequest('PUT', `/api/admin/academy-sections/${createdId}`, updateData);
      console.log(`Status: ${putResult.status}`);
      console.log('Response:', JSON.stringify(putResult.body, null, 2));

      if (putResult.status === 200 && putResult.body.ok) {
        const updated = putResult.body.data;
        if (updated.title === updateData.title) {
          console.log('✅ Section updated successfully - title changed');
        } else {
          console.log('⚠️  Title not reflected in response:', updated.title);
        }
      } else {
        console.log(`⚠️  Unexpected response`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log('\n====================================\n');

    // Step 5: Test GET endpoint (verify update)
    console.log(`📌 Step 5: Testing GET /api/admin/academy-sections/${createdId} (Verify Update)\n`);
    try {
      const getAllResult = await makeRequest('GET', '/api/admin/academy-sections');
      if (getAllResult.status === 200 && getAllResult.body.ok) {
        const section = getAllResult.body.data?.find(s => s.id === createdId);
        if (section) {
          console.log('Retrieved section:', JSON.stringify(section, null, 2));
          console.log(`✅ Section found in database`);
          if (section.title === 'Updated Academy Section Title') {
            console.log('✅✅ UPDATE WAS PERSISTED CORRECTLY!');
          } else {
            console.log('⚠️  WARNING: Title in DB does NOT match what we sent:', section.title);
          }
        } else {
          console.log(`⚠️  Section ID ${createdId} not found in database`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log('\n====================================\n');

    // Step 6: Test DELETE endpoint
    console.log(`📌 Step 6: Testing DELETE /api/admin/academy-sections/${createdId}\n`);
    try {
      const deleteResult = await makeRequest('DELETE', `/api/admin/academy-sections/${createdId}`);
      console.log(`Status: ${deleteResult.status}`);
      console.log('Response:', JSON.stringify(deleteResult.body, null, 2));

      if (deleteResult.status === 200 && deleteResult.body.ok) {
        console.log(`✅ Section deleted`);
      } else {
        console.log(`⚠️  Unexpected response`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    console.log('\n====================================\n');

    // Step 7: Verify deletion
    console.log(`📌 Step 7: Verifying deletion\n`);
    try {
      const getAllResult = await makeRequest('GET', '/api/admin/academy-sections');
      if (getAllResult.status === 200 && getAllResult.body.ok) {
        const section = getAllResult.body.data?.find(s => s.id === createdId);
        if (!section) {
          console.log(`✅ Section ID ${createdId} successfully removed from database`);
        } else {
          console.log(`⚠️  WARNING: Section ID ${createdId} still exists in database`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  } else {
    console.log('⚠️  Skipping PUT/DELETE tests - no ID from POST');
  }

  console.log('\n====================================');
  console.log('✅ Test suite completed\n');
}

console.log('Waiting 1 second for server to be ready...\n');
setTimeout(runTests, 1000);
