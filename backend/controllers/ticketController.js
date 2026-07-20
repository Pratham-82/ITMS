const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Category = require('../models/Category');
const TicketService = require('../services/ticketService');
const { sendEscalationNotifications } = require('../services/notificationService');

// Utility helpers for permissions
const isSuperAdmin = (user) => (
  user.role === 'admin' && (!user.department || user.department === 'General Administration')
);

const canAccessTicket = (user, ticket) => {
  if (user.role === 'citizen') {
    const citizenId = ticket.citizen?._id || ticket.citizen;
    return citizenId && citizenId.toString() === user.id;
  }

  if (user.role === 'admin') {
    const assignedUserId = ticket.assignedTo?._id || ticket.assignedTo;
    return (
      isSuperAdmin(user) ||
      (assignedUserId && assignedUserId.toString() === user.id)
    );
  }

  return false;
};

// ==========================================
// TICKET TYPES CONTROLLERS
// ==========================================

// @desc    Get all ticket types
// @route   GET /api/tickets/types
// @access  Private
const getTicketTypes = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const query = { tenantId, isActive: true };
    
    // Filter by role if user is citizen
    if (req.user.role === 'citizen') {
      query.allowedRoles = 'citizen';
    }

    const types = await TicketType.find(query);
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new ticket type
// @route   POST /api/tickets/types
// @access  Private (Admin only)
const createTicketType = async (req, res) => {
  try {
    const { name, code, description, icon, color, allowedRoles, settings, isActive } = req.body;
    const tenantId = req.user.tenantId || 'default-tenant';

    const existing = await TicketType.findOne({ name, tenantId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ticket type with this name already exists' });
    }

    const ticketType = await TicketType.create({
      tenantId,
      name,
      code,
      description,
      icon,
      color,
      allowedRoles,
      settings,
      isActive
    });

    res.status(201).json({ success: true, data: ticketType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update ticket type
// @route   PUT /api/tickets/types/:id
// @access  Private (Admin only)
const updateTicketType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    let ticketType = await TicketType.findOne({ _id: req.params.id, tenantId });

    if (!ticketType) {
      return res.status(404).json({ success: false, message: 'Ticket type not found' });
    }

    ticketType = await TicketType.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: ticketType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete ticket type
// @route   DELETE /api/tickets/types/:id
// @access  Private (Admin only)
const deleteTicketType = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const ticketType = await TicketType.findOne({ _id: req.params.id, tenantId });

    if (!ticketType) {
      return res.status(404).json({ success: false, message: 'Ticket type not found' });
    }

    ticketType.isActive = false;
    await ticketType.save();

    res.status(200).json({ success: true, message: 'Ticket type deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// TICKET LIFECYCLE CONTROLLERS
// ==========================================

// @desc    Create new ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res) => {
  try {
    let customFieldsParsed = {};
    if (req.body.customFields) {
      try {
        customFieldsParsed = typeof req.body.customFields === 'string'
          ? JSON.parse(req.body.customFields)
          : req.body.customFields;
      } catch (err) {
        console.error('Error parsing custom fields:', err);
      }
    }

    let aiRoutingParsed = undefined;
    if (req.body.aiRouting) {
      try {
        aiRoutingParsed = typeof req.body.aiRouting === 'string'
          ? JSON.parse(req.body.aiRouting)
          : req.body.aiRouting;
      } catch (err) {
        console.error('Error parsing AI routing details:', err);
      }
    }

    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push(`/uploads/${file.filename}`);
      });
    }

    let assetsArray = [];
    if (req.body.relatedAssets) {
      assetsArray = Array.isArray(req.body.relatedAssets) ? req.body.relatedAssets : [req.body.relatedAssets];
    } else if (req.body.asset) {
      assetsArray = [req.body.asset];
    }

    const ticketData = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      department: req.body.department,
      priority: req.body.priority,
      ticketType: req.body.ticketType,
      duplicateOverrideReason: req.body.duplicateOverrideReason,
      parentTicketId: req.body.parentTicketId,
      relatedAssets: assetsArray,
      customFields: customFieldsParsed,
      aiRouting: aiRoutingParsed,
      attachments
    };

    const ticket = await TicketService.createTicket(ticketData, req.user);
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tickets
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res) => {
  try {
    const result = await TicketService.getTickets(req.query, req.user);
    console.log('[BACKEND GET TICKETS] Logged-in User:', {
      id: req.user.id,
      role: req.user.role,
      department: req.user.department,
      tenantId: req.user.tenantId
    });
    res.status(200).json({
      success: true,
      count: result.tickets.length,
      pagination: {
        page: result.page,
        limit: result.limit,
        pages: result.pages,
        total: result.total
      },
      data: result.tickets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicketById = async (req, res) => {
  try {
    const ticket = await TicketService.getTicketById(req.params.id, req.user);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Unauthorized to view this ticket') {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update ticket status
// @route   PUT /api/tickets/:id/status
// @access  Private (Admin only)
const updateTicketStatus = async (req, res) => {
  try {
    const { status, assignedTo, escalationType, escalationGroupId, holdDuration, holdUntilCustom } = req.body;
    const ticket = await TicketService.updateTicketStatus(
      req.params.id, 
      { status, assignedTo, escalationType, escalationGroupId, holdDuration, holdUntilCustom }, 
      req.user
    );
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add comment to ticket
// @route   POST /api/tickets/:id/comments
// @access  Private
const addComment = async (req, res) => {
  try {
    const comments = await TicketService.addComment(req.params.id, req.body, req.user);
    res.status(201).json({
      success: true,
      data: comments
    });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (error.message.includes('Cannot add comments')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Escalate ticket (Citizen only)
// @route   PUT /api/tickets/:id/escalate
// @access  Private (Citizen only)
const escalateTicket = async (req, res) => {
  try {
    const ticket = await TicketService.escalateTicket(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Not authorized to escalate this ticket') {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (
      error.message === 'Please provide a reason for escalation' ||
      error.message === 'This ticket has already been escalated' ||
      error.message.includes('Cannot escalate a ticket')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit feedback on resolved ticket
// @route   POST /api/tickets/:id/feedback
// @access  Private (Citizen only)
const submitTicketFeedback = async (req, res) => {
  try {
    const ticket = await TicketService.submitTicketFeedback(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, message: 'Feedback submitted successfully', data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Not authorized to submit feedback for this ticket') {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message === 'Feedback can only be submitted for resolved tickets') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reopen a resolved ticket
// @route   POST /api/tickets/:id/reopen
// @access  Private (Citizen only)
const reopenTicket = async (req, res) => {
  try {
    const ticket = await TicketService.reopenTicket(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, message: 'Reopen request submitted successfully', data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Not authorized to reopen this ticket') {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (
      error.message === 'Please provide a reason for reopening the ticket' ||
      error.message === 'Only resolved or closed tickets can be reopened'
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve or reject a ticket reopening request
// @route   POST /api/tickets/:id/reopen/review
// @access  Private (Admin only)
const reviewReopenRequest = async (req, res) => {
  try {
    const ticket = await TicketService.reviewReopenRequest(req.params.id, req.body, req.user);
    const action = req.body.action;
    res.status(200).json({ success: true, message: `Reopen request ${action}ed successfully`, data: ticket });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (
      error.message === 'Not authorized: Admins only' ||
      error.message === 'Not authorized to review this ticket request'
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (
      error.message === 'Please specify a valid action (approve or reject)' ||
      error.message === 'This ticket does not have a pending reopen request'
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  addComment,
  escalateTicket,
  submitTicketFeedback,
  reopenTicket,
  reviewReopenRequest
};
