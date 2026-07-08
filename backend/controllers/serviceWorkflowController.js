const ServiceWorkflow = require('../models/ServiceWorkflow');

// System reserved states that MUST exist in all workflows for service requests
const RESERVED_STATES = ['Pending', 'Closed'];

// @desc    Get all service workflows
// @route   GET /api/service-workflows
// @access  Private (Admin only)
const getServiceWorkflows = async (req, res) => {
  try {
    const workflows = await ServiceWorkflow.find().sort({ workflowName: 1 }).lean();
    res.status(200).json({ success: true, data: workflows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get service workflow by ID
// @route   GET /api/service-workflows/:id
// @access  Private
const getServiceWorkflowById = async (req, res) => {
  try {
    const workflow = await ServiceWorkflow.findById(req.params.id).lean();
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Service workflow not found' });
    }
    res.status(200).json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new service workflow
// @route   POST /api/service-workflows
// @access  Private (Admin only)
const createServiceWorkflow = async (req, res) => {
  try {
    const { workflowName, states, transitions } = req.body;

    if (!workflowName || !workflowName.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a workflow name' });
    }

    const existingWorkflow = await ServiceWorkflow.findOne({ workflowName: workflowName.trim() });
    if (existingWorkflow) {
      return res.status(400).json({ success: false, message: 'A service workflow with this name already exists' });
    }

    // Validate reserved states
    const stateNames = (states || []).map(s => s.name);
    for (const resState of RESERVED_STATES) {
      if (!stateNames.includes(resState)) {
        return res.status(400).json({
          success: false,
          message: `Validation Error: Service workflow must contain state "${resState}"`
        });
      }
    }

    // Set isReserved flag automatically on reserved states
    const processedStates = states.map(s => ({
      ...s,
      isReserved: RESERVED_STATES.includes(s.name)
    }));

    const workflow = await ServiceWorkflow.create({
      workflowName: workflowName.trim(),
      states: processedStates,
      transitions: transitions || []
    });

    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a service workflow
// @route   PUT /api/service-workflows/:id
// @access  Private (Admin only)
const updateServiceWorkflow = async (req, res) => {
  try {
    const { workflowName, states, transitions, isActive } = req.body;

    let workflow = await ServiceWorkflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Service workflow not found' });
    }

    if (workflowName && workflowName.trim() !== workflow.workflowName) {
      const existingWorkflow = await ServiceWorkflow.findOne({ workflowName: workflowName.trim(), _id: { $ne: req.params.id } });
      if (existingWorkflow) {
        return res.status(400).json({ success: false, message: 'A service workflow with this name already exists' });
      }
      workflow.workflowName = workflowName.trim();
    }

    if (states) {
      // Validate reserved states
      const stateNames = states.map(s => s.name);
      for (const resState of RESERVED_STATES) {
        if (!stateNames.includes(resState)) {
          return res.status(400).json({
            success: false,
            message: `Validation Error: Service workflow must contain state "${resState}"`
          });
        }
      }

      // Set isReserved flag
      workflow.states = states.map(s => ({
        ...s,
        isReserved: RESERVED_STATES.includes(s.name)
      }));
    }

    if (transitions) {
      workflow.transitions = transitions;
    }

    if (isActive !== undefined) {
      workflow.isActive = isActive;
    }

    await workflow.save();
    res.status(200).json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete service workflow (Soft delete)
// @route   DELETE /api/service-workflows/:id
// @access  Private (Admin only)
const deleteServiceWorkflow = async (req, res) => {
  try {
    const workflow = await ServiceWorkflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Service workflow not found' });
    }

    workflow.isActive = false;
    await workflow.save();

    res.status(200).json({ success: true, message: 'Service workflow deactivated successfully', data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getServiceWorkflows,
  getServiceWorkflowById,
  createServiceWorkflow,
  updateServiceWorkflow,
  deleteServiceWorkflow
};
