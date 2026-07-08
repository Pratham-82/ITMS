const express = require('express');
const router = express.Router();
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService
} = require('../controllers/serviceController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getServices)
  .post(protect, authorize('admin'), checkSettingsPermission('manageFields'), createService);

router.route('/:id')
  .get(protect, getServiceById)
  .put(protect, authorize('admin'), checkSettingsPermission('manageFields'), updateService)
  .delete(protect, authorize('admin'), checkSettingsPermission('manageFields'), deleteService);

module.exports = router;
