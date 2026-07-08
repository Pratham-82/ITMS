const Settings = require('../models/Settings');

// @desc    Get system settings
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'system_branding' });
    
    // Auto initialize settings if database is empty
    if (!settings) {
      settings = await Settings.create({ key: 'system_branding' });
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private (Admin only)
const updateSettings = async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'admin' && (!req.user.department || req.user.department === 'General Administration');
    const hasPermission = req.user.settingsPermissions && req.user.settingsPermissions.allowAll && req.user.settingsPermissions.systemSettings;
    if (!isSuperAdmin && !hasPermission) {
      return res.status(403).json({ success: false, message: 'Access denied. Only Super Administrators or authorized officers can modify system configuration settings.' });
    }

    let settings = await Settings.findOne({ key: 'system_branding' });

    if (!settings) {
      settings = new Settings({ key: 'system_branding' });
    }

    const { 
      websiteName, websiteDescription, primaryColor, contactEmail, allowCitizenRegistration,
      feedbackExpiryDays, feedbackWelcomeMessage, feedbackSuccessMessage, feedbackRatingIcon
    } = req.body;

    if (websiteName !== undefined) settings.websiteName = websiteName;
    if (websiteDescription !== undefined) settings.websiteDescription = websiteDescription;
    if (primaryColor !== undefined) settings.primaryColor = primaryColor;
    if (contactEmail !== undefined) settings.contactEmail = contactEmail;
    if (allowCitizenRegistration !== undefined) {
      settings.allowCitizenRegistration = allowCitizenRegistration === 'true' || allowCitizenRegistration === true;
    }

    if (feedbackExpiryDays !== undefined) settings.feedbackExpiryDays = Number(feedbackExpiryDays);
    if (feedbackWelcomeMessage !== undefined) settings.feedbackWelcomeMessage = feedbackWelcomeMessage;
    if (feedbackSuccessMessage !== undefined) settings.feedbackSuccessMessage = feedbackSuccessMessage;
    if (feedbackRatingIcon !== undefined) settings.feedbackRatingIcon = feedbackRatingIcon;

    if (req.body.feedbackQuestions !== undefined) {
      try {
        const parsed = typeof req.body.feedbackQuestions === 'string'
          ? JSON.parse(req.body.feedbackQuestions)
          : req.body.feedbackQuestions;
        if (Array.isArray(parsed)) {
          settings.feedbackQuestions = parsed;
        }
      } catch (err) {
        console.error('Failed to parse feedbackQuestions:', err);
      }
    }

    // Process logo image upload if present
    if (req.file) {
      settings.websiteLogo = `/uploads/${req.file.filename}`;
    }

    settings.updatedAt = Date.now();
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'System configuration updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
