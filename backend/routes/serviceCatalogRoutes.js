const express = require('express');
const router = express.Router();
const {
  getServiceCatalogs,
  getServiceCatalogById,
  createServiceCatalog,
  updateServiceCatalog,
  deleteServiceCatalog
} = require('../controllers/serviceCatalogController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getServiceCatalogs)
  .post(protect, authorize('admin'), checkSettingsPermission('manageFields'), createServiceCatalog);

router.route('/:id')
  .get(protect, getServiceCatalogById)
  .put(protect, authorize('admin'), checkSettingsPermission('manageFields'), updateServiceCatalog)
  .delete(protect, authorize('admin'), checkSettingsPermission('manageFields'), deleteServiceCatalog);

module.exports = router;
