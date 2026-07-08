const express = require('express');
const router = express.Router();
const {
  getServiceWorkflows,
  getServiceWorkflowById,
  createServiceWorkflow,
  updateServiceWorkflow,
  deleteServiceWorkflow
} = require('../controllers/serviceWorkflowController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getServiceWorkflows)
  .post(protect, authorize('admin'), checkSettingsPermission('escalationRules'), createServiceWorkflow);

router.route('/:id')
  .get(protect, getServiceWorkflowById)
  .put(protect, authorize('admin'), checkSettingsPermission('escalationRules'), updateServiceWorkflow)
  .delete(protect, authorize('admin'), checkSettingsPermission('escalationRules'), deleteServiceWorkflow);

module.exports = router;
