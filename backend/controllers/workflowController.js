const Workflow = require('../models/Workflow');
const Complaint = require('../models/Ticket');
const Category = require('../models/Category');

// System reserved states that MUST exist in all workflows for MERN compatibility
const RESERVED_STATES = ['Pending', 'Awaiting Feedback', 'Closed', 'Reopen Requested'];

// @desc    Get all workflows
// @route   GET /api/workflows
// @access  Private (Admin only)
const getWorkflows = async (req, res) => {
  try {
    const workflows = await Workflow.find().populate('categoryId', 'name departmentName');
    res.status(200).json({ success: true, data: workflows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get workflow by category ID
// @route   GET /api/workflows/category/:categoryId
// @access  Private
const getWorkflowByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    let workflow = await Workflow.findOne({ categoryId });

    if (!workflow) {
      // Return a default virtual workflow if none is configured
      const category = await Category.findById(categoryId);
      const categoryName = category ? category.name : 'Unknown';

      workflow = {
        workflowName: `Default ${categoryName} Workflow`,
        categoryId,
        categoryName,
        isActive: false,
        isDefaultFallback: true,
        states: [
          { name: 'Pending', description: 'Newly filed complaint', isReserved: true },
          { name: 'Investigating', description: 'Complaint is under review', isReserved: false },
          { name: 'On Hold', description: 'Complaint is paused temporarily', isReserved: false },
          { name: 'Resolved', description: 'Resolved by officer', isReserved: false },
          { name: 'Awaiting Feedback', description: 'Awaiting citizen feedback', isReserved: true },
          { name: 'Closed', description: 'Complaint is completed', isReserved: true },
          { name: 'Rejected', description: 'Complaint has been rejected', isReserved: false },
          { name: 'Reopen Requested', description: 'Citizen requested to reopen', isReserved: true }
        ],
        transitions: [
          { fromState: 'Pending', toState: 'Investigating', label: 'Start Investigation', allowedRole: 'admin', actions: {} },
          { fromState: 'Investigating', toState: 'On Hold', label: 'Place on Hold', allowedRole: 'admin', actions: {} },
          { fromState: 'On Hold', toState: 'Investigating', label: 'Resume Investigation', allowedRole: 'admin', actions: {} },
          { fromState: 'Investigating', toState: 'Resolved', label: 'Resolve Issue', allowedRole: 'admin', actions: {} },
          { fromState: 'Investigating', toState: 'Rejected', label: 'Reject Issue', allowedRole: 'admin', actions: {} },
          { fromState: 'Resolved', toState: 'Awaiting Feedback', label: 'Ask Citizen Feedback', allowedRole: 'admin', actions: {} },
          { fromState: 'Awaiting Feedback', toState: 'Closed', label: 'Accept & Close', allowedRole: 'citizen', actions: {} },
          { fromState: 'Awaiting Feedback', toState: 'Reopen Requested', label: 'Request Reopen', allowedRole: 'citizen', actions: {} },
          { fromState: 'Reopen Requested', toState: 'Investigating', label: 'Approve Reopen', allowedRole: 'admin', actions: {} },
          { fromState: 'Reopen Requested', toState: 'Closed', label: 'Reject Reopen', allowedRole: 'admin', actions: {} }
        ]
      };
    }

    res.status(200).json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new workflow
// @route   POST /api/workflows
// @access  Private (Super Admin only)
const createWorkflow = async (req, res) => {
  try {
    const { workflowName, categoryId, states, transitions } = req.body;

    const existingWorkflow = await Workflow.findOne({ categoryId });
    if (existingWorkflow) {
      return res.status(400).json({ success: false, message: 'A workflow already exists for this category' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Invalid category specified' });
    }

    // Validate reserved states
    const stateNames = states.map(s => s.name);
    for (const resState of RESERVED_STATES) {
      if (!stateNames.includes(resState)) {
        return res.status(400).json({
          success: false,
          message: `Validation Error: Workflow must contain system-reserved state "${resState}"`
        });
      }
    }

    // Set isReserved flag automatically on reserved states
    const processedStates = states.map(s => ({
      ...s,
      isReserved: RESERVED_STATES.includes(s.name)
    }));

    const workflow = new Workflow({
      workflowName,
      categoryId,
      categoryName: category.name,
      states: processedStates,
      transitions
    });

    const savedWorkflow = await workflow.save();
    res.status(201).json({ success: true, data: savedWorkflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a workflow
// @route   PUT /api/workflows/:id
// @access  Private (Super Admin only)
const updateWorkflow = async (req, res) => {
  try {
    const { workflowName, states, transitions, isActive } = req.body;
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    // Validate reserved states in update payload
    const stateNames = states.map(s => s.name);
    for (const resState of RESERVED_STATES) {
      if (!stateNames.includes(resState)) {
        return res.status(400).json({
          success: false,
          message: `Validation Error: Workflow must contain system-reserved state "${resState}"`
        });
      }
    }

    // Check if any state being removed is currently used by active (non-Closed) complaints
    const oldStates = workflow.states.map(s => s.name);
    const newStates = states.map(s => s.name);
    const deletedStates = oldStates.filter(s => !newStates.includes(s));

    if (deletedStates.length > 0) {
      // Find open complaints in the deleted states
      const activeCount = await Complaint.countDocuments({
        category: workflow.categoryId,
        status: { $in: deletedStates }
      });

      if (activeCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot update workflow: There are ${activeCount} active complaints currently in the states being deleted: [${deletedStates.join(', ')}]. Please reassign those complaints first.`
        });
      }
    }

    // Update fields
    workflow.workflowName = workflowName || workflow.workflowName;
    workflow.isActive = isActive !== undefined ? isActive : workflow.isActive;

    // Set isReserved flag automatically on reserved states
    workflow.states = states.map(s => ({
      ...s,
      isReserved: RESERVED_STATES.includes(s.name)
    }));

    workflow.transitions = transitions;

    const updatedWorkflow = await workflow.save();
    res.status(200).json({ success: true, data: updatedWorkflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a workflow
// @route   DELETE /api/workflows/:id
// @access  Private (Super Admin only)
const deleteWorkflow = async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    // Optional: check if there are complaints that would be orphaned or fallback
    await Workflow.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWorkflows,
  getWorkflowByCategory,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
};
