const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');

// @desc    Create a service request
// @route   POST /api/service-requests
// @access  Private (Citizen only)
const createServiceRequest = async (req, res) => {
  try {
    const { serviceId, customFields, assetId } = req.body;

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Please specify a service' });
    }

    const service = await Service.findById(serviceId).populate('workflow');
    if (!service || !service.isActive) {
      return res.status(404).json({ success: false, message: 'Service not found or inactive' });
    }

    // Automatically resolve assignments from service configuration
    const assignedDepartment = service.assignment?.department || null;
    const assignedGroup = service.assignment?.group || null;
    const assignedTo = service.assignment?.staff || null;

    // Resolve starting status based on workflow if present
    const initialStatus = service.workflow?.states?.[0]?.name || 'Pending';

    const serviceRequest = await ServiceRequest.create({
      service: serviceId,
      citizen: req.user.id,
      customFields: customFields || {},
      status: initialStatus,
      assignedDepartment,
      assignedGroup,
      assignedTo,
      asset: assetId || null,
      history: [{
        action: `Service request submitted for service "${service.name}"`,
        actor: req.user.name
      }]
    });

    res.status(201).json({
      success: true,
      data: serviceRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get service requests
// @route   GET /api/service-requests
// @access  Private
const getServiceRequests = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'citizen') {
      filter.citizen = req.user.id;
    } else {
      // If admin/staff, they can filter by assignment or view all
      const { status, departmentId } = req.query;
      if (status) {
        filter.status = status;
      }
      if (departmentId) {
        filter.assignedDepartment = departmentId;
      }
      const isSuperAdmin = req.user.role === 'admin' && (
        (req.user.groups && req.user.groups.length > 0 && req.user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
        ((!req.user.groups || req.user.groups.length === 0) && (!req.user.department || req.user.department === 'General Administration'))
      );
      if (!isSuperAdmin) {
        const deptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
        if (departmentId) {
          const requestedDeptId = departmentId.toString();
          if (deptIds.map(String).includes(requestedDeptId)) {
            filter.assignedDepartment = departmentId;
          } else {
            filter.assignedDepartment = null;
          }
        } else {
          filter.assignedDepartment = { $in: deptIds };
        }
      } else if (departmentId) {
        filter.assignedDepartment = departmentId;
      }
    }

    const requests = await ServiceRequest.find(filter)
      .populate({
        path: 'service',
        select: 'name description catalog workflow',
        populate: {
          path: 'workflow',
          select: 'workflowName states transitions'
        }
      })
      .populate('citizen', 'name email')
      .populate('assignedDepartment', 'name')
      .populate('assignedGroup', 'name')
      .populate('assignedTo', 'name email')
      .populate('asset', 'name assetCode serialNumber')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single service request by ID
// @route   GET /api/service-requests/:id
// @access  Private
const getServiceRequestById = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id)
      .populate({
        path: 'service',
        populate: [
          {
            path: 'catalog',
            select: 'name icon color'
          },
          {
            path: 'workflow',
            select: 'workflowName states transitions'
          }
        ]
      })
      .populate('citizen', 'name email')
      .populate('assignedDepartment', 'name')
      .populate('assignedGroup', 'name')
      .populate('assignedTo', 'name email')
      .populate('comments.sender', 'name role')
      .populate('asset', 'name assetCode serialNumber')
      .lean();

    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    // Citizen can only access their own request
    if (req.user.role === 'citizen' && request.citizen._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this request' });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update service request status
// @route   PUT /api/service-requests/:id/status
// @access  Private (Admin only)
const updateServiceRequestStatus = async (req, res) => {
  try {
    const { status, assignedTo, assignedGroup } = req.body;

    let request = await ServiceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized: Admins/Staff only' });
    }

    const previousStatus = request.status;
    const service = await Service.findById(request.service).populate('workflow');
    
    if (service && service.workflow) {
      const allowedStates = service.workflow.states.map(s => s.name);
      if (status && !allowedStates.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid workflow status: ${status}` });
      }
      if (status && status !== previousStatus) {
        const transition = service.workflow.transitions.find(
          t => t.fromState === previousStatus && t.toState === status
        );
        const transitionLabel = transition ? transition.label : 'Workflow Transition';
        
        request.status = status;
        request.history.push({
          action: `Status transitioned from "${previousStatus}" to "${status}" (➔ ${transitionLabel})`,
          actor: req.user.name
        });
      }
    } else {
      if (status && !['Pending', 'In Progress', 'Resolved', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      if (status && status !== previousStatus) {
        request.status = status;
        request.history.push({
          action: `Status updated from "${previousStatus}" to "${status}"`,
          actor: req.user.name
        });
      }
    }

    if (assignedTo !== undefined) {
      request.assignedTo = assignedTo || null;
      if (assignedTo) {
        const User = require('../models/User');
        const officer = await User.findById(assignedTo);
        request.history.push({
          action: `Assigned to officer: ${officer ? officer.name : 'Unknown Officer'}`,
          actor: req.user.name
        });
      }
    }

    if (assignedGroup !== undefined) {
      request.assignedGroup = assignedGroup || null;
      if (assignedGroup) {
        const EscalationGroup = require('../models/EscalationGroup');
        const groupObj = await EscalationGroup.findById(assignedGroup);
        request.history.push({
          action: `Assigned to support group: ${groupObj ? groupObj.name : 'Unknown Group'}`,
          actor: req.user.name
        });
      }
    }

    await request.save();

    // Populate and return updated request
    const updatedRequest = await ServiceRequest.findById(req.params.id)
      .populate({
        path: 'service',
        populate: {
          path: 'workflow',
          select: 'workflowName states transitions'
        }
      })
      .populate('citizen', 'name email')
      .populate('assignedDepartment', 'name')
      .populate('assignedGroup', 'name')
      .populate('assignedTo', 'name email')
      .populate('comments.sender', 'name role')
      .lean();

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add comment to service request
// @route   POST /api/service-requests/:id/comments
// @access  Private
const addServiceRequestComment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Comment message cannot be empty' });
    }

    let request = await ServiceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }

    // Citizen can only comment on their own requests
    if (req.user.role === 'citizen' && request.citizen.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to comment on this request' });
    }

    const newComment = {
      sender: req.user.id,
      senderName: req.user.name,
      message: message.trim(),
      createdAt: new Date()
    };

    request.comments.push(newComment);
    request.history.push({
      action: `New response added by ${req.user.role === 'admin' ? 'Officer' : 'Citizen'} (${req.user.name})`,
      actor: req.user.name
    });

    await request.save();

    const updatedRequest = await ServiceRequest.findById(req.params.id)
      .populate('comments.sender', 'name role')
      .lean();

    res.status(201).json({
      success: true,
      data: updatedRequest.comments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  updateServiceRequestStatus,
  addServiceRequestComment
};
