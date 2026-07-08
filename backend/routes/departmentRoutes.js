const express = require('express');
const router = express.Router();
const { 
  getDepartments, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment 
} = require('../controllers/departmentController');
const { 
  assignCategoryToDepartment,
  removeCategoryFromDepartment,
  updateCategoryDepartmentMapping
} = require('../controllers/categoryController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

// Public/Citizen read access, but modifications restricted to Admin only
router.route('/')
  .get(getDepartments)
  .post(protect, authorize('admin'), checkSettingsPermission('manageDepartments'), createDepartment);

router.route('/:id')
  .put(protect, authorize('admin'), checkSettingsPermission('manageDepartments'), updateDepartment)
  .delete(protect, authorize('admin'), checkSettingsPermission('manageDepartments'), deleteDepartment);

router.route('/:departmentId/categories/:categoryId')
  .post(protect, authorize('admin'), checkSettingsPermission('manageDepartments'), assignCategoryToDepartment)
  .put(protect, authorize('admin'), checkSettingsPermission('manageDepartments'), updateCategoryDepartmentMapping)
  .delete(protect, authorize('admin'), checkSettingsPermission('manageDepartments'), removeCategoryFromDepartment);

module.exports = router;
