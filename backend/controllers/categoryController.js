const Category = require('../models/Category');
const Department = require('../models/Department');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const { department } = req.query;
    const filter = {};
    if (req.user.role === 'citizen') {
      filter.isActive = true;
    }

    if (department) {
      const DepartmentCategory = require('../models/DepartmentCategory');
      const mappings = await DepartmentCategory.find({ department, isActive: true })
        .populate('category')
        .lean();

      const categories = mappings
        .map(m => m.category)
        .filter(Boolean)
        .filter(c => !filter.hasOwnProperty('isActive') || c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));

      return res.status(200).json({
        success: true,
        count: categories.length,
        data: categories
      });
    }

    const categories = await Category.find(filter).sort({ name: 1 }).lean(); 
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Private
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new category template
// @route   POST /api/categories
// @access  Private (Admin only)
const createCategory = async (req, res) => {
  try {
    const { name, description, fields } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify a category name' });
    }

    const exists = await Category.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category with this name already exists' });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      fields: fields || []
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category template
// @route   PUT /api/categories/:id
// @access  Private (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { name, description, fields, isActive } = req.body;

    let category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category template not found' });
    }

    if (name && name.trim() !== category.name) {
      const exists = await Category.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Category with this name already exists' });
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description.trim();
    if (fields) category.fields = fields;
    if (isActive !== undefined) category.isActive = isActive;

    const updatedCategory = await category.save();

    res.status(200).json({
      success: true,
      data: updatedCategory
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category template (Soft delete)
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category template not found' });
    }

    category.isActive = false;
    await category.save();

    const DepartmentCategory = require('../models/DepartmentCategory');
    await DepartmentCategory.updateMany(
      { category: category._id },
      { $set: { isActive: false } }
    );

    res.status(200).json({
      success: true,
      message: 'Category deactivated successfully',
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign category to department
// @route   POST /api/departments/:departmentId/categories/:categoryId
// @access  Private (Admin only)
const assignCategoryToDepartment = async (req, res) => {
  try {
    const { departmentId, categoryId } = req.params;
    const { assignedGroup } = req.body;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const DepartmentCategory = require('../models/DepartmentCategory');
    let mapping = await DepartmentCategory.findOne({ department: departmentId, category: categoryId });

    if (mapping) {
      if (mapping.isActive) {
        return res.status(400).json({ success: false, message: 'Category is already assigned to this department' });
      } else {
        mapping.isActive = true;
        mapping.assignedGroup = assignedGroup || null;
        await mapping.save();
      }
    } else {
      mapping = await DepartmentCategory.create({
        department: departmentId,
        category: categoryId,
        assignedGroup: assignedGroup || null,
        isActive: true
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category assigned to department successfully',
      data: mapping
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove category from department (Soft delete mapping)
// @route   DELETE /api/departments/:departmentId/categories/:categoryId
// @access  Private (Admin only)
const removeCategoryFromDepartment = async (req, res) => {
  try {
    const { departmentId, categoryId } = req.params;

    const DepartmentCategory = require('../models/DepartmentCategory');
    const mapping = await DepartmentCategory.findOne({ department: departmentId, category: categoryId });

    if (!mapping) {
      return res.status(404).json({ success: false, message: 'Mapping not found' });
    }

    mapping.isActive = false;
    await mapping.save();

    res.status(200).json({
      success: true,
      message: 'Category assignment removed from department successfully',
      data: mapping
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category department mapping (e.g., assign to group/team)
// @route   PUT /api/departments/:departmentId/categories/:categoryId
// @access  Private (Admin only)
const updateCategoryDepartmentMapping = async (req, res) => {
  try {
    const { departmentId, categoryId } = req.params;
    const { assignedGroup } = req.body;

    const DepartmentCategory = require('../models/DepartmentCategory');
    const mapping = await DepartmentCategory.findOne({ department: departmentId, category: categoryId });

    if (!mapping) {
      return res.status(404).json({ success: false, message: 'Mapping not found' });
    }

    if (assignedGroup !== undefined) {
      mapping.assignedGroup = assignedGroup || null;
    }

    await mapping.save();

    res.status(200).json({
      success: true,
      message: 'Category mapping updated successfully',
      data: mapping
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  assignCategoryToDepartment,
  removeCategoryFromDepartment,
  updateCategoryDepartmentMapping
};
