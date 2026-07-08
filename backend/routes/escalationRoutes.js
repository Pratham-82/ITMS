const express = require('express');
const router = express.Router();
const {
  getEscalationRules,
  getEscalationRuleById,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule
} = require('../controllers/escalationController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getEscalationRules)
  .post(protect, authorize('admin'), checkSettingsPermission('escalationRules'), createEscalationRule);

router.route('/:id')
  .get(protect, authorize('admin'), getEscalationRuleById)
  .put(protect, authorize('admin'), checkSettingsPermission('escalationRules'), updateEscalationRule)
  .delete(protect, authorize('admin'), checkSettingsPermission('escalationRules'), deleteEscalationRule);

module.exports = router;
