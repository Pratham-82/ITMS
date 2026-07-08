const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models after plugin registration in db.js
const User = require('./models/User');
const AiSettings = require('./models/AiSettings');
const AiPrompt = require('./models/AiPrompt');
const AiRoutingLog = require('./models/AiRoutingLog');
const AiConfigAuditLog = require('./models/AiConfigAuditLog');
const Category = require('./models/Category');
const Department = require('./models/Department');

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== STARTING AI GOVERNANCE MODULE INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Cleanup old test data (bypass tenant scoping to clear records from previous failed runs under other subdomains/tenants)
    console.log('\n[1] Cleaning up old test users...');
    await User.deleteMany({ email: { $in: ['ai_superadmin@apex.com', 'ai_citizen@apex.com'] } }).setOptions({ bypassTenant: true });
    console.log('Cleanup complete.');

    // 2. Seed test Super Admin and Citizen
    console.log('\n[2] Seeding test accounts...');
    const superAdmin = await User.create({
      name: 'AI Super Admin',
      email: 'ai_superadmin@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'General Administration'
    });

    const citizen = await User.create({
      name: 'AI Citizen Test',
      email: 'ai_citizen@apex.com',
      password: 'password123',
      role: 'citizen'
    });
    console.log('Seeding complete.');

    // 3. Login to retrieve tokens
    console.log('\n[3] Logging in to retrieve JWT tokens...');
    const superAdminLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ai_superadmin@apex.com', password: 'password123' })
    });
    const superAdminLoginData = await superAdminLoginRes.json();
    const adminToken = superAdminLoginData.data.token;

    const citizenLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ai_citizen@apex.com', password: 'password123' })
    });
    const citizenLoginData = await citizenLoginRes.json();
    const citizenToken = citizenLoginData.data.token;
    console.log('Tokens retrieved successfully.');

    // 4. Test Settings endpoints
    console.log('\n[4] Testing AI Settings endpoints...');
    const settingsGetRes = await fetch(`${API_BASE}/ai/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const settingsGetData = await settingsGetRes.json();
    console.log('GET Settings Success:', settingsGetData.success);
    
    // API key should be redacted or empty
    console.log('API Key in response (should be redacted):', settingsGetData.data.apiKey || '[EMPTY]');

    // Update settings (putting test api key)
    console.log('Updating AI Settings with test parameters...');
    const settingsPutRes = await fetch(`${API_BASE}/ai/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        enableAiRouting: true,
        autoAcceptThreshold: 0.85,
        aiProvider: 'google_gemini',
        apiKey: 'sk-test-gemini-key-12345-abcde',
        modelName: 'gemini-1.5-flash'
      })
    });
    const settingsPutData = await settingsPutRes.json();
    console.log('PUT Settings Success:', settingsPutData.success);
    console.log('Model Name updated to:', settingsPutData.data.modelName);

    // Verify key is encrypted in database
    const dbSettingsObj = await AiSettings.findOne({ key: 'ai_routing_config' });
    console.log('Encrypted API key stored in MongoDB:', dbSettingsObj.apiKey);
    if (dbSettingsObj.apiKey.startsWith('sk-')) {
      throw new Error('API Key was stored in plain text instead of encrypted format!');
    }
    console.log('API Key verified to be correctly encrypted in DB.');

    // 5. Test Prompt Versioning & Rollback
    console.log('\n[5] Testing Prompt Versioning...');
    const promptPostRes = await fetch(`${API_BASE}/ai/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        systemPrompt: 'System prompt test version',
        classificationPrompt: 'Choose department: {departments} and category: {categories}',
        fallbackPrompt: 'Fallback rule test prompt',
        reasoningPrompt: 'Reasoning check test prompt',
        description: 'Integration test prompt version 2'
      })
    });
    const promptPostData = await promptPostRes.json();
    console.log('POST Prompts Version Success:', promptPostData.success);
    console.log('New Prompt Version number:', promptPostData.data.version);

    // Fetch history
    const historyRes = await fetch(`${API_BASE}/ai/prompts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const historyData = await historyRes.json();
    console.log('Prompt version history length:', historyData.data.length);

    // Rollback to version 1
    const v1Prompt = historyData.data.find(p => p.version === 1);
    if (v1Prompt) {
      console.log('Rolling back active prompt to Version 1...');
      const rollbackRes = await fetch(`${API_BASE}/ai/prompts/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ promptId: v1Prompt._id })
      });
      const rollbackData = await rollbackRes.json();
      console.log('Rollback Endpoint Success:', rollbackData.success);
      console.log('Currently Active Prompt Version is now:', rollbackData.data.version);
    }

    // 6. Test rate limiter
    console.log('\n[6] Testing classification rate limiter...');
    // Hardcoded rate limit is 20 per minute. Let's make 21 requests.
    let rateLimitReached = false;
    for (let i = 1; i <= 21; i++) {
      const classRes = await fetch(`${API_BASE}/ai/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`
        },
        body: JSON.stringify({ title: 'AC Broken', description: 'The AC unit is blowing hot air' })
      });
      const classData = await classRes.json();
      console.log(`Request #${i} response status:`, classRes.status, `Success:`, classData.success);
      if (classRes.status === 429) {
        rateLimitReached = true;
        console.log('Rate limiter triggered successfully! Message:', classData.message);
        break;
      }
    }
    if (!rateLimitReached) {
      throw new Error('Rate limiter failed to trigger after exceeding limit!');
    }

    // 7. Test Configuration Audit Logs
    console.log('\n[7] Testing Audit Logging...');
    const auditRes = await fetch(`${API_BASE}/ai/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditData = await auditRes.json();
    console.log('Audit logs returned count:', auditData.data.length);
    console.log('Most recent audited action:', auditData.data[0]?.action);

    // 8. Test Cache flushing
    console.log('\n[8] Testing cache clearing...');
    const clearRes = await fetch(`${API_BASE}/ai/cache/clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const clearData = await clearRes.json();
    console.log('Cache clear Success:', clearData.success);

    // 9. Test Analytics and Health Endpoints
    console.log('\n[9] Checking health status and analytics...');
    const healthRes = await fetch(`${API_BASE}/ai/health`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const healthData = await healthRes.json();
    console.log('Health status:', healthData.data.providerStatus);
    console.log('Success Rate:', healthData.data.successRate, '%');

    const analyticsRes = await fetch(`${API_BASE}/ai/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const analyticsData = await analyticsRes.json();
    console.log('Analytics items count (Total Predictions):', analyticsData.data.totalClassifications);

    console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('\n*** TEST SUITE FAILED WITH ERROR ***');
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
}

runTests();
