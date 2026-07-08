const dotenv = require('dotenv');
const path = require('path');
// Load environment variables from backend directory specifically
dotenv.config({ path: path.join(__dirname, '.env') });

// Register global multi-tenant Mongoose plugin and connect to Database BEFORE compiling any models
const connectDB = require('./config/db');
connectDB();

const express = require('express');
const cors = require('cors');

// Start background escalation scheduler
const { initScheduler } = require('./services/scheduler');
initScheduler();


const app = express();
app.set('trust proxy', 1);

// Middlewares
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const originUrl = new URL(origin);
    for (const allowed of allowedOrigins) {
      const allowedUrl = new URL(allowed);
      if (originUrl.protocol === allowedUrl.protocol && originUrl.port === allowedUrl.port) {
        const originHost = originUrl.hostname;
        const allowedHost = allowedUrl.hostname;
        if (originHost === allowedHost || originHost.endsWith('.' + allowedHost)) {
          return true;
        }
      }
    }
  } catch (err) {
    // Ignore URL parse error
  }
  return false;
};

// Self-configuring CORS to automatically allow same-host requests (with tenant subdomains)
const corsOptionsDelegate = (req, callback) => {
  let corsOptions;
  const origin = req.header('Origin');
  
  if (!origin) {
    // No Origin header (same-origin non-GET request), allow it
    corsOptions = { origin: true };
    return callback(null, corsOptions);
  }

  // Get host from request headers
  const requestHost = req.headers['x-forwarded-host'] || req.headers.host || '';
  const requestHostname = requestHost.split(':')[0].toLowerCase();
  
  try {
    const originHostname = new URL(origin).hostname.toLowerCase();
    
    // If origin matches request hostname (or is a subdomain of it), allow it automatically
    if (originHostname === requestHostname || originHostname.endsWith('.' + requestHostname)) {
      corsOptions = { origin: true };
      return callback(null, corsOptions);
    }
  } catch (err) {
    // Ignore URL parse error
  }

  // Fallback to configured allowed origins list
  if (isOriginAllowed(origin)) {
    corsOptions = { origin: true };
  } else {
    corsOptions = { origin: false };
  }
  callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Tenancy Context Middleware
const { tenantMiddleware } = require('./middleware/tenantMiddleware');
app.use(tenantMiddleware);

// Rate Limiting Security Middleware
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// Static folder for file uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/tickets', require('./routes/ticketRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/escalations', require('./routes/escalationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/csat', require('./routes/csatRoutes'));
app.use('/api/workload', require('./routes/workloadRoutes'));
app.use('/api/workflows', require('./routes/workflowRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/duplicates', require('./routes/duplicateRoutes'));
app.use('/api/groups', require('./routes/escalationGroupRoutes'));
app.use('/api/calendars', require('./routes/calendarRoutes'));
app.use('/api/sla-configs', require('./routes/slaConfigRoutes'));
app.use('/api/holidays', require('./routes/holidayRoutes'));
app.use('/api/maintenance-windows', require('./routes/maintenanceWindowRoutes'));
app.use('/api/blackout-periods', require('./routes/blackoutPeriodRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/asset-categories', require('./routes/assetCategoryRoutes'));
app.use('/api/asset-types', require('./routes/assetTypeRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/asset-relationships', require('./routes/assetRelationshipRoutes'));
app.use('/api/service-catalogs', require('./routes/serviceCatalogRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/service-requests', require('./routes/serviceRequestRoutes'));
app.use('/api/service-workflows', require('./routes/serviceWorkflowRoutes'));
app.use('/api/metadata', require('./routes/metadataRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
} else {
  // Root path fallback
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the ApexResolve API' });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
});
