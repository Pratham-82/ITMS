const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const crypto = require('crypto');

// Compile models
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const TicketType = require('./models/TicketType');
const Category = require('./models/Category');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const WebhookSubscription = require('./models/WebhookSubscription');
const TicketService = require('./services/ticketService');
const webhookService = require('./services/webhookService');

const PORT = 8999;
const TEST_SECRET = 'super_secret_webhook_signature_key_123';

async function testWebhooks() {
  console.log('=== STARTING OUTBOUND WEBHOOKS ENGINE VERIFICATION ===');
  let testServer;
  
  try {
    await connectDB();
    console.log('Connected to MongoDB database.');

    // 1. Setup local mock listener server to capture dispatched webhook payloads
    const app = express();
    app.use(express.json());

    let lastReceivedEvent = null;
    let lastReceivedHeaders = {};
    let lastReceivedBody = null;

    app.post('/webhook-endpoint', (req, res) => {
      lastReceivedEvent = req.headers['x-apexresolve-event'];
      lastReceivedHeaders = req.headers;
      lastReceivedBody = req.body;
      
      console.log(`[Mock Server] Received POST callback. Event: ${lastReceivedEvent}`);
      res.status(200).json({ success: true, received: true });
    });

    testServer = app.listen(PORT, () => {
      console.log(`[Mock Server] Running on http://localhost:${PORT}/webhook-endpoint`);
    });

    // 2. Setup mock tenant metadata
    const tenantId = 'test-tenant';
    const tenantLocalStorage = require('./middleware/tenantContext');

    await tenantLocalStorage.run(tenantId, async () => {
      // Clean up old instances
      await User.deleteMany({ email: 'wh_citizen@apex.com' }).setOptions({ bypassTenant: true });
      await Category.deleteMany({ name: 'Test WH Category' }).setOptions({ bypassTenant: true });
      await Department.deleteMany({ name: 'Test WH Department' }).setOptions({ bypassTenant: true });
      await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
      await WebhookSubscription.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await TicketType.deleteMany({ tenantId }).setOptions({ bypassTenant: true });

      // Create configurations
      const citizen = await User.create({
        name: 'Citizen WH Tester',
        email: 'wh_citizen@apex.com',
        password: 'password123',
        role: 'citizen',
        tenantId
      });

      const category = await Category.create({ name: 'Test WH Category', tenantId });
      const department = await Department.create({ name: 'Test WH Department', tenantId, isActive: true });
      
      await DepartmentCategory.create({
        department: department._id,
        category: category._id,
        isActive: true,
        tenantId
      });

      // Seed default ticket type 'Complaint'
      const ticketType = await TicketType.create({
        name: 'Complaint',
        code: 'CMP',
        description: 'Default Complaint Incident Ticket Type',
        tenantId
      });

      // Register mock Webhook subscription
      const subscription = await WebhookSubscription.create({
        name: 'Local Test Integration',
        url: `http://localhost:${PORT}/webhook-endpoint`,
        secret: TEST_SECRET,
        events: ['ticket.created', 'ticket.status_changed'],
        isActive: true,
        tenantId
      });

      console.log(`Registered Webhook Subscription ID: ${subscription._id}`);

      // 3. Create a ticket (should trigger ticket.created webhook)
      console.log('\n--- Creating Ticket (expecting ticket.created event) ---');
      const ticketData = {
        title: 'Webhook Test Issue',
        description: 'Verifying automated dispatches',
        category: category._id.toString(),
        department: department._id.toString(),
        priority: 'Low',
        ticketType: ticketType._id.toString()
      };

      const ticket = await TicketService.createTicket(ticketData, citizen);
      console.log(`Created Ticket ID: ${ticket._id}, Tracking ID: ${ticket.trackingId}`);

      // Give a brief delay for asynchronous dispatch to arrive
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Validate webhook arrival
      if (!lastReceivedEvent) {
        throw new Error('Verification Failed: No webhook event was received by the mock server.');
      }

      console.log(`\nVerified Event Type Header: ${lastReceivedEvent}`);
      if (lastReceivedEvent !== 'ticket.created') {
        throw new Error(`Expected event type "ticket.created", got "${lastReceivedEvent}"`);
      }

      // Verify HMAC signature validation
      const signatureHeader = lastReceivedHeaders['x-apexresolve-signature'];
      console.log(`Verified Signature Header: ${signatureHeader}`);
      if (!signatureHeader) {
        throw new Error('HMAC signature was not received in headers.');
      }

      const expectedSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(JSON.stringify(lastReceivedBody))
        .digest('hex');

      if (signatureHeader !== expectedSignature) {
        throw new Error(`Signature Mismatch! Got: ${signatureHeader}, Expected: ${expectedSignature}`);
      }
      console.log('HMAC SHA-256 signature validates perfectly.');

      // Check body content
      if (lastReceivedBody.event !== 'ticket.created' || lastReceivedBody.tenantId !== tenantId) {
        throw new Error('Payload event metadata mismatch.');
      }
      console.log(`Verified Payload Body. Ticket title is: "${lastReceivedBody.data.title}"`);

      // 4. Test Webhook Controller Ping Dispatcher
      console.log('\n--- Testing Webhook Controller Manual Ping Endpoint ---');
      
      const { testWebhook } = require('./controllers/webhookController');
      
      // Simulate Express req/res
      const req = {
        params: { id: subscription._id.toString() },
        user: { name: 'Admin Tester', tenantId }
      };

      let responseStatus = 0;
      let responseJson = {};
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseJson = data;
            }
          };
        }
      };

      await testWebhook(req, res);
      
      console.log(`Controller response status: ${responseStatus}`);
      console.log(`Controller response JSON message: "${responseJson.message}"`);

      if (responseStatus !== 200 || !responseJson.success) {
        throw new Error(`Manual webhook test failed with status: ${responseStatus}`);
      }

      // Give time for test ping to arrive
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`Mock server last received event: ${lastReceivedEvent}`);
      if (lastReceivedEvent !== 'webhook.test') {
        throw new Error('Test ping event was not processed by dispatcher.');
      }

      console.log('\nAll integrations are working cleanly!');
      
      // 5. Cleanup database data
      await User.deleteMany({ email: 'wh_citizen@apex.com' }).setOptions({ bypassTenant: true });
      await Category.deleteMany({ name: 'Test WH Category' }).setOptions({ bypassTenant: true });
      await Department.deleteMany({ name: 'Test WH Department' }).setOptions({ bypassTenant: true });
      await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
      await WebhookSubscription.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await TicketType.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
    });

  } catch (error) {
    console.error('\n*** TEST ERROR ***', error);
    process.exit(1);
  } finally {
    if (testServer) {
      testServer.close();
      console.log('Mock Server closed.');
    }
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
    console.log('=== ENDING WEBHOOKS VERIFICATION ===');
  }
}

testWebhooks();
