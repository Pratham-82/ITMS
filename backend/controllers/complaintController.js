/**
 * @deprecated Legacy complaint controller (compatibility layer).
 * @description Delegates requests to the unified ticketController.
 */

const ticketController = require('./ticketController');
const TicketType = require('../models/TicketType');

const createComplaint = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const defaultType = await TicketType.findOne({ name: 'Complaint', tenantId });
    if (!defaultType) {
      return res.status(500).json({ success: false, message: 'Default Complaint ticket type not found' });
    }
    req.body.ticketType = defaultType._id.toString();
    await ticketController.createTicket(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getComplaints = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'default-tenant';
    const defaultType = await TicketType.findOne({ name: 'Complaint', tenantId });
    if (defaultType) {
      req.query.ticketTypeId = defaultType._id.toString();
    }
    await ticketController.getTickets(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getComplaintById = async (req, res) => {
  await ticketController.getTicketById(req, res);
};

const updateComplaintStatus = async (req, res) => {
  await ticketController.updateTicketStatus(req, res);
};

const addComment = async (req, res) => {
  await ticketController.addComment(req, res);
};

const escalateComplaint = async (req, res) => {
  await ticketController.escalateTicket(req, res);
};

const submitComplaintFeedback = async (req, res) => {
  await ticketController.submitTicketFeedback(req, res);
};

const reopenComplaint = async (req, res) => {
  await ticketController.reopenTicket(req, res);
};

const reviewReopenRequest = async (req, res) => {
  await ticketController.reviewReopenRequest(req, res);
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  addComment,
  escalateComplaint,
  submitComplaintFeedback,
  reopenComplaint,
  reviewReopenRequest
};
