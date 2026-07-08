const Department = require('../models/Department');
const Category = require('../models/Category');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 }).populate('routingGroup', 'name').lean();
    const DepartmentCategory = require('../models/DepartmentCategory');
    
    const populatedDepts = await Promise.all(departments.map(async (dept) => {
      const mappings = await DepartmentCategory.find({ department: dept._id, isActive: true })
        .populate('category')
        .populate('assignedGroup', 'name')
        .lean();
      
      const categories = mappings
        .map(m => {
          if (!m.category) return null;
          return {
            ...m.category,
            assignedGroup: m.assignedGroup || null
          };
        })
        .filter(Boolean)
        .filter(c => c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        ...dept,
        categories
      };
    }));

    res.status(200).json({
      success: true,
      count: populatedDepts.length,
      data: populatedDepts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new department
// @route   POST /api/departments
// @access  Private (Admin only)
const createDepartment = async (req, res) => {
  try {
    const { name, description, routingGroup } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify a department name' });
    }

    const exists = await Department.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Department already exists with this name' });
    }

    const department = await Department.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      routingGroup: routingGroup || null
    });

    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a department
// @route   PUT /api/departments/:id
// @access  Private (Admin only)
const updateDepartment = async (req, res) => {
  try {
    const { name, description, isActive, routingGroup } = req.body;
    let department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Capture old name to update related Category departmentName if name changes
    const oldName = department.name;

    if (name !== undefined && name.trim()) {
      department.name = name.trim();
    }
    if (description !== undefined) {
      department.description = description.trim();
    }
    if (isActive !== undefined) {
      department.isActive = isActive;
    }
    if (routingGroup !== undefined) {
      department.routingGroup = routingGroup || null;
    }

    await department.save();

    // If the name changed, update all categories related to this department
    if (name !== undefined && name.trim() && name.trim() !== oldName) {
      await Category.updateMany(
        { department: department._id },
        { $set: { departmentName: name.trim() } }
      );
    }

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete/Deactivate department
// @route   DELETE /api/departments/:id
// @access  Private (Admin only)
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Toggle active status instead of hard deletion to preserve historic complaints relations
    department.isActive = false;
    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department deactivated successfully',
      data: department
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
