const express = require('express');
const router = express.Router();
const { 
  registerTenant, 
  getTenantInfo, 
  getAllTenants, 
  updateTenant, 
  deleteTenant 
} = require('../controllers/tenantController');
const { protect } = require('../middleware/authMiddleware');
const { superAdminOnly } = require('../middleware/superAdminMiddleware');

router.post('/register', registerTenant);
router.get('/info', getTenantInfo);

// SaaS Platform Owner endpoints
router.get('/', protect, superAdminOnly, getAllTenants);
router.put('/:id', protect, superAdminOnly, updateTenant);
router.delete('/:id', protect, superAdminOnly, deleteTenant);

module.exports = router;

