const express = require('express');
const router = express.Router();
const {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup
} = require('../controllers/escalationGroupController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, authorize('admin'), getGroups)
  .post(protect, authorize('admin'), checkSettingsPermission('escalationRules'), createGroup);

router.route('/:id')
  .get(protect, authorize('admin'), getGroupById)
  .put(protect, authorize('admin'), checkSettingsPermission('escalationRules'), updateGroup)
  .delete(protect, authorize('admin'), checkSettingsPermission('escalationRules'), deleteGroup);

module.exports = router;
