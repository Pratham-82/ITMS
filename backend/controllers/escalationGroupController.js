const EscalationGroup = require('../models/EscalationGroup');
const User = require('../models/User');

// @desc    Get all escalation groups
// @route   GET /api/groups
// @access  Private (Admin only)
const getGroups = async (req, res) => {
  try {
    const groups = await EscalationGroup.find()
      .populate('leader', 'name email')
      .populate('backupLeader', 'name email')
      .populate('members', 'name email role availabilityStatus')
      .populate('department', 'name');
    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single group by ID
// @route   GET /api/groups/:id
// @access  Private (Admin only)
const getGroupById = async (req, res) => {
  try {
    const group = await EscalationGroup.findById(req.params.id)
      .populate('leader', 'name email')
      .populate('backupLeader', 'name email')
      .populate('members', 'name email role availabilityStatus')
      .populate('department', 'name');
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    
    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new escalation group
// @route   POST /api/groups
// @access  Private (Admin only)
const createGroup = async (req, res) => {
  try {
    const { name, description, leader, backupLeader, members, department, isActive } = req.body;

    const existingGroup = await EscalationGroup.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ success: false, message: 'Group name already exists' });
    }

    const group = await EscalationGroup.create({
      name,
      description,
      leader: leader || null,
      backupLeader: backupLeader || null,
      members: members || [],
      department,
      isActive: isActive !== undefined ? isActive : true
    });

    // Update members' group memberships in User documents
    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members } },
        { $addToSet: { groups: group._id } }
      );
    }

    res.status(201).json({
      success: true,
      data: group
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update escalation group
// @route   PUT /api/groups/:id
// @access  Private (Admin only)
const updateGroup = async (req, res) => {
  try {
    const { name, description, leader, backupLeader, members, department, isActive } = req.body;

    let group = await EscalationGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const oldMembers = group.members || [];

    if (name !== undefined) group.name = name;
    if (description !== undefined) group.description = description;
    if (leader !== undefined) group.leader = leader || null;
    if (backupLeader !== undefined) group.backupLeader = backupLeader || null;
    if (members !== undefined) group.members = members || [];
    if (department !== undefined) group.department = department;
    if (isActive !== undefined) group.isActive = isActive;

    const updatedGroup = await group.save();

    // Re-sync User group arrays
    if (members !== undefined) {
      // Remove this group from users who are no longer members
      const removedMembers = oldMembers.filter(m => !members.map(String).includes(String(m)));
      if (removedMembers.length > 0) {
        await User.updateMany(
          { _id: { $in: removedMembers } },
          { $pull: { groups: group._id } }
        );
      }
      
      // Add this group to new members
      if (members.length > 0) {
        await User.updateMany(
          { _id: { $in: members } },
          { $addToSet: { groups: group._id } }
        );
      }
    }

    res.status(200).json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete escalation group
// @route   DELETE /api/groups/:id
// @access  Private (Admin only)
const deleteGroup = async (req, res) => {
  try {
    const group = await EscalationGroup.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Pull from all Users
    await User.updateMany(
      { groups: group._id },
      { $pull: { groups: group._id } }
    );

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup
};
