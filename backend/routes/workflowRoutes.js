const express = require('express');
const router = express.Router();
const {
  getWorkflows,
  getWorkflowByCategory,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
} = require('../controllers/workflowController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getWorkflows)
  .post(protect, authorize('admin'), checkSettingsPermission('escalationRules'), createWorkflow);

router.route('/category/:categoryId')
  .get(protect, getWorkflowByCategory);

router.route('/:id')
  .put(protect, authorize('admin'), checkSettingsPermission('escalationRules'), updateWorkflow)
  .delete(protect, authorize('admin'), checkSettingsPermission('escalationRules'), deleteWorkflow);

module.exports = router;
