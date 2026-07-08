const express = require('express');
const router = express.Router();
const {
  getEntities,
  getEntityByCode,
  createEntity,
  updateEntity,
  deleteEntity,
  getFields,
  createField,
  updateField,
  deleteField,
  getRelationships,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getAudits
} = require('../controllers/metadataController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Entity definitions
router.route('/entities')
  .get(protect, getEntities)
  .post(protect, authorize('admin'), createEntity);

router.route('/entities/:code')
  .get(protect, getEntityByCode)
  .put(protect, authorize('admin'), updateEntity)
  .delete(protect, authorize('admin'), deleteEntity);

// Field definitions
router.route('/fields')
  .get(protect, getFields)
  .post(protect, authorize('admin'), createField);

router.route('/fields/:entityCode/:fieldKey')
  .put(protect, authorize('admin'), updateField)
  .delete(protect, authorize('admin'), deleteField);

// Relationship definitions
router.route('/relationships')
  .get(protect, getRelationships)
  .post(protect, authorize('admin'), createRelationship);

router.route('/relationships/:id')
  .put(protect, authorize('admin'), updateRelationship)
  .delete(protect, authorize('admin'), deleteRelationship);

// Audit trails
router.route('/audit')
  .get(protect, authorize('admin'), getAudits);

module.exports = router;
