const Complaint = require('../models/Ticket');
const DuplicateGroup = require('../models/DuplicateGroup');
const DuplicateAuditLog = require('../models/DuplicateAuditLog');
const AiSettings = require('../models/AiSettings');
const EscalationRule = require('../models/EscalationRule');
const Category = require('../models/Category');
const duplicateService = require('../services/duplicateService');

/**
 * Helper to fetch settings
 */
const getAiSettings = async () => {
  let settings = await AiSettings.findOne({ key: 'ai_routing_config' });
  if (!settings) {
    settings = { enableAiRouting: true, aiProvider: 'google_gemini', apiKey: '' };
  }
  return settings;
};

/**
 * @desc    Check duplicates in real time before submission
 * @route   POST /api/duplicates/check
 * @access  Private
 */
const checkDuplicateLive = async (req, res) => {
  try {
    const { title, description, categoryId, departmentName } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const settings = await getAiSettings();
    const candidates = await duplicateService.findCandidates({
      title,
      description,
      categoryId,
      departmentName,
      settings
    });

    res.status(200).json({
      success: true,
      data: candidates
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Join an existing complaint as a supporter
 * @route   POST /api/duplicates/:id/join
 * @access  Private
 */
const joinComplaint = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { remarks } = req.body;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    if (complaint.isDuplicate) {
      return res.status(400).json({ 
        success: false, 
        message: `This ticket has been marked as a duplicate. Please join the parent ticket: ${complaint.parentTicketId}` 
      });
    }

    // Check if user is already the creator or a supporter
    if (complaint.citizen.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You are the creator of this complaint and already support it.' });
    }

    const alreadyJoined = complaint.supporters.some(s => s.userId.toString() === req.user.id);
    if (alreadyJoined) {
      return res.status(400).json({ success: false, message: 'You have already joined/supported this complaint.' });
    }

    // Add user as supporter
    complaint.supporters.push({
      userId: req.user.id,
      userName: req.user.name,
      joinDate: Date.now(),
      remarks: remarks || ''
    });

    // 1. Recalculate Impact Score
    // Severity weight
    const severityWeights = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
    const severityWeight = severityWeights[complaint.priority] || 1;

    // Category weight
    let categoryWeight = 1.0;
    const catName = (complaint.categoryName || '').toLowerCase();
    if (catName.includes('outage') || catName.includes('leakage') || catName.includes('breach') || catName.includes('failure') || catName.includes('repair')) {
      categoryWeight = 2.0;
    } else if (catName.includes('discrepancy') || catName.includes('refund')) {
      categoryWeight = 1.5;
    }

    complaint.impactScore = Math.round(complaint.supporters.length * severityWeight * categoryWeight);

    // 2. Auto Priority Escalation based on supporters count
    const count = complaint.supporters.length;
    const oldPriority = complaint.priority;
    let priorityUpgraded = false;

    if (count >= 50 && complaint.priority !== 'Critical') {
      complaint.priority = 'Critical';
      priorityUpgraded = true;
    } else if (count >= 25 && !['Critical', 'High'].includes(complaint.priority)) {
      complaint.priority = 'High';
      priorityUpgraded = true;
    } else if (count >= 10 && !['Critical', 'High', 'Medium'].includes(complaint.priority)) {
      complaint.priority = 'Medium';
      priorityUpgraded = true;
    }

    if (priorityUpgraded) {
      complaint.history.push({
        action: `Priority auto-escalated from ${oldPriority} to ${complaint.priority} due to ${count} supporters.`,
        actor: 'System'
      });

      // Log priority audit change
      await DuplicateAuditLog.create({
        userId: null,
        userName: 'System',
        action: 'PRIORITY_CHANGED',
        complaintId: complaint._id,
        reason: `${count} supporters thresholds exceeded`,
        previousValue: oldPriority,
        newValue: complaint.priority
      });

      // Re-trigger SLA deadline if Escalation Rules are active
      const rule = await EscalationRule.findOne({ 
        departmentId: complaint.department,
        categoryId: complaint.category, 
        isActive: true 
      });
      if (rule && rule.levels && rule.levels.length > 0) {
        const level1 = rule.levels.find(l => l.level === 1);
        if (level1) {
          const hours = level1.durationHours || 24;
          complaint.nextEscalationDueAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        }
      }
    }

    // 3. Update/Create Duplicate Group
    let dupGroup = await DuplicateGroup.findOne({ parentComplaintId: complaint._id });
    if (!dupGroup) {
      dupGroup = new DuplicateGroup({ parentComplaintId: complaint._id });
    }
    dupGroup.supporterCount = complaint.supporters.length;
    dupGroup.impactScore = complaint.impactScore;
    await dupGroup.save();

    complaint.duplicateGroupId = dupGroup._id;
    await complaint.save();

    // Log join audit
    await DuplicateAuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'COMPLAINT_JOINED',
      complaintId: complaint._id,
      reason: remarks || 'Joined as affected supporter'
    });

    res.status(200).json({
      success: true,
      message: `Successfully joined complaint ${complaint.trackingId}.`,
      data: {
        supportersCount: complaint.supporters.length,
        impactScore: complaint.impactScore,
        priority: complaint.priority
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Merge duplicate complaints into a master complaint
 * @route   POST /api/duplicates/merge
 * @access  Private (Admin only)
 */
const mergeComplaints = async (req, res) => {
  try {
    const { masterComplaintId, duplicateComplaintIds, reason } = req.body;

    if (!masterComplaintId || !duplicateComplaintIds || !Array.isArray(duplicateComplaintIds) || duplicateComplaintIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Master complaint and duplicate complaint list are required.' });
    }

    const master = await Complaint.findById(masterComplaintId);
    if (!master) {
      return res.status(404).json({ success: false, message: 'Master complaint not found.' });
    }

    let duplicateCountAdded = 0;
    const mergeAuditRecords = [];
    const savePromises = [];

    // Retrieve all candidates in a single bulk query
    const targetDupIds = duplicateComplaintIds.filter(id => id.toString() !== masterComplaintId.toString());
    const duplicates = await Complaint.find({ _id: { $in: targetDupIds } });

    for (const dup of duplicates) {
      if (dup.isDuplicate) continue; // Already merged

      // Mark duplicate ticket
      dup.isDuplicate = true;
      dup.parentTicketId = master._id;
      dup.status = 'Closed'; // resolve/close it
      dup.closureType = 'Auto Closed';
      dup.history.push({
        action: `Merged into Master complaint: ${master.trackingId}`,
        actor: req.user.name
      });
      savePromises.push(dup.save());

      // Consolidate attachments
      if (dup.attachments && dup.attachments.length > 0) {
        master.attachments.push(...dup.attachments);
      }

      // Consolidate comments
      if (dup.comments && dup.comments.length > 0) {
        dup.comments.forEach(c => {
          master.comments.push({
            sender: c.sender,
            senderName: `[Merged from ${dup.trackingId}] ${c.senderName}`,
            message: c.message,
            createdAt: c.createdAt
          });
        });
      }

      // Consolidate history
      dup.history.forEach(h => {
        master.history.push({
          action: `[Merged from ${dup.trackingId}] ${h.action}`,
          actor: h.actor,
          createdAt: h.createdAt
        });
      });

      // Consolidate unique supporters
      if (dup.supporters && dup.supporters.length > 0) {
        dup.supporters.forEach(ds => {
          const alreadyExists = master.supporters.some(ms => ms.userId.toString() === ds.userId.toString());
          const isCreator = master.citizen.toString() === ds.userId.toString();
          if (!alreadyExists && !isCreator) {
            master.supporters.push(ds);
          }
        });
      }

      // Track duplicate reference in master
      master.mergedTickets.push({
        ticketId: dup._id,
        trackingId: dup.trackingId,
        mergedAt: Date.now(),
        mergedBy: req.user.name,
        reason: reason || 'Identical issue duplicate merging'
      });

      duplicateCountAdded++;

      // Log audit
      mergeAuditRecords.push({
        userId: req.user.id,
        userName: req.user.name,
        action: 'COMPLAINT_MERGED',
        complaintId: dup._id,
        parentComplaintId: master._id,
        reason: reason || 'Merged by administrator'
      });
    }

    if (duplicateCountAdded > 0) {
      // Recalculate impact score
      const severityWeights = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
      const severityWeight = severityWeights[master.priority] || 1;

      let categoryWeight = 1.0;
      const catName = (master.categoryName || '').toLowerCase();
      if (catName.includes('outage') || catName.includes('leakage') || catName.includes('breach') || catName.includes('failure') || catName.includes('repair')) {
        categoryWeight = 2.0;
      }

      master.impactScore = Math.round(master.supporters.length * severityWeight * categoryWeight);

      // Auto update priority if needed
      const count = master.supporters.length;
      if (count >= 50 && master.priority !== 'Critical') {
        master.priority = 'Critical';
      } else if (count >= 25 && !['Critical', 'High'].includes(master.priority)) {
        master.priority = 'High';
      } else if (count >= 10 && !['Critical', 'High', 'Medium'].includes(master.priority)) {
        master.priority = 'Medium';
      }

      // Save master duplicate group updates
      let dupGroup = await DuplicateGroup.findOne({ parentComplaintId: master._id });
      if (!dupGroup) {
        dupGroup = new DuplicateGroup({ parentComplaintId: master._id });
      }
      dupGroup.duplicateCount = (dupGroup.duplicateCount || 0) + duplicateCountAdded;
      dupGroup.supporterCount = master.supporters.length;
      dupGroup.impactScore = master.impactScore;
      await dupGroup.save();

      master.duplicateGroupId = dupGroup._id;
      master.duplicateCount = dupGroup.duplicateCount;

      master.history.push({
        action: `Merged ${duplicateCountAdded} duplicate complaints into this ticket.`,
        actor: req.user.name
      });
      // Save all updated duplicate documents in parallel
      await Promise.all(savePromises);
      await master.save();

      // Write audits
      for (const aud of mergeAuditRecords) {
        await DuplicateAuditLog.create(aud);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully merged ${duplicateCountAdded} complaints into ${master.trackingId}.`,
      data: {
        masterId: master._id,
        trackingId: master.trackingId,
        duplicateCount: master.duplicateCount,
        supportersCount: master.supporters.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get duplicate prevention audit logs
 * @route   GET /api/duplicates/audits
 * @access  Private (Admin only)
 */
const getAuditLogs = async (req, res) => {
  try {
    const logs = await DuplicateAuditLog.find()
      .populate('complaintId', 'trackingId title')
      .populate('parentComplaintId', 'trackingId title')
      .sort({ createdAt: -1 })
      .limit(100);
      
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get recurring issues list with AI recommendations
 * @route   GET /api/duplicates/recurring
 * @access  Private (Admin only)
 */
const getRecurringRecommendations = async (req, res) => {
  try {
    const settings = await getAiSettings();

    // Group active complaints by category and custom field location (e.g., Floor, Room)
    // to identify repeated issues (size >= 3 in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const complaints = await Complaint.find({
      createdAt: { $gte: thirtyDaysAgo },
      isDuplicate: false
    });

    const groups = {};
    complaints.forEach(c => {
      // Create a key combining category name and custom location properties if any
      const locFloor = c.customFields?.['Floor Number'] || c.customFields?.['Floor / Section'] || '';
      const locRoom = c.customFields?.['Specific Room / Cubicle'] || c.customFields?.['Incident Spot Location'] || '';
      const locKey = (locFloor || locRoom) ? `${locFloor} ${locRoom}`.trim() : 'General Location';
      const key = `${c.categoryName}::${locKey}`;

      if (!groups[key]) {
        groups[key] = {
          categoryName: c.categoryName,
          location: locKey,
          tickets: []
        };
      }
      groups[key].tickets.push(c);
    });

    const recurringClusters = [];
    const promptInstructions = [];

    Object.entries(groups).forEach(([key, val]) => {
      if (val.tickets.length >= 3) {
        recurringClusters.push({
          categoryName: val.categoryName,
          location: val.location,
          ticketCount: val.tickets.length,
          recentTickets: val.tickets.map(t => ({ id: t._id, trackingId: t.trackingId, title: t.title })),
          recommendation: `Multiple repeated ${val.categoryName} tickets detected in location: "${val.location}". Suggested review and preventative infrastructure inspection.`
        });
      }
    });

    // Optionally generate smart AI recommendations using LLM if enabled
    if (settings.enableAiRouting && recurringClusters.length > 0 && settings.apiKey) {
      try {
        const decryptedKey = decrypt(settings.apiKey) || process.env.GEMINI_API_KEY || '';
        if (decryptedKey) {
          for (const cluster of recurringClusters) {
            // Short LLM call to draft a precise recommendation
            const prompt = `A complaint management system detected ${cluster.ticketCount} recent unresolved "${cluster.categoryName}" tickets at location "${cluster.location}". Write a single clear, actionable 1-sentence recommendation (under 15 words) for facilities admins. Example: "Recurring WiFi failures detected in Block A. Infrastructure upgrade recommended."`;
            
            const model = settings.modelName || 'gemini-2.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedKey}`;
            
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 100, temperature: 0.2 }
              })
            });

            if (response.ok) {
              const data = await response.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text.trim()) {
                cluster.recommendation = text.replace(/["']/g, '').trim();
              }
            }
          }
        }
      } catch (aiErr) {
        console.error('[RecurringAI] Failed generating recommendations:', aiErr);
      }
    }

    res.status(200).json({
      success: true,
      data: recurringClusters
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  checkDuplicateLive,
  joinComplaint,
  mergeComplaints,
  getAuditLogs,
  getRecurringRecommendations
};
