const SlaConfiguration = require('../models/SlaConfiguration');

// @desc    Get all SLA configurations
// @route   GET /api/sla-configs
// @access  Private (Admin only)
const getSlaConfigs = async (req, res) => {
  try {
    const configs = await SlaConfiguration.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get default SLA configuration
// @route   GET /api/sla-configs/default
// @access  Private (Admin only)
const getDefaultSlaConfig = async (req, res) => {
  try {
    let config = await SlaConfiguration.findOne({ isDefault: true });
    if (!config) {
      config = await SlaConfiguration.findOne({ name: 'Standard SLA Matrix' });
      if (config) {
        config.isDefault = true;
        await config.save();
      } else {
        // Create standard default priority matrix
        config = await SlaConfiguration.create({
          name: 'Standard SLA Matrix',
          isDefault: true,
          priorities: {
            Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 240 },
            High: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
            Medium: { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
            Low: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 }
          }
        });
      }
    }
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get SLA configuration by ID
// @route   GET /api/sla-configs/:id
// @access  Private (Admin only)
const getSlaConfigById = async (req, res) => {
  try {
    const config = await SlaConfiguration.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'SLA Configuration not found' });
    }
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create SLA configuration
// @route   POST /api/sla-configs
// @access  Private (Admin only)
const createSlaConfig = async (req, res) => {
  try {
    const { name, priorities, isDefault, breachActions, multiBreachRules, riskScoreRules } = req.body;

    const existingConfig = await SlaConfiguration.findOne({ name });
    if (existingConfig) {
      return res.status(400).json({ success: false, message: 'SLA Configuration name already exists' });
    }

    const config = await SlaConfiguration.create({
      name,
      priorities,
      isDefault: isDefault !== undefined ? isDefault : false,
      breachActions,
      multiBreachRules,
      riskScoreRules
    });

    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update SLA configuration
// @route   PUT /api/sla-configs/:id
// @access  Private (Admin only)
const updateSlaConfig = async (req, res) => {
  try {
    const { name, priorities, isDefault, breachActions, multiBreachRules, riskScoreRules } = req.body;

    let config = await SlaConfiguration.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'SLA Configuration not found' });
    }

    if (name !== undefined) config.name = name;
    if (priorities !== undefined) config.priorities = priorities;
    if (isDefault !== undefined) config.isDefault = isDefault;
    if (breachActions !== undefined) config.breachActions = breachActions;
    if (multiBreachRules !== undefined) config.multiBreachRules = multiBreachRules;
    if (riskScoreRules !== undefined) config.riskScoreRules = riskScoreRules;

    const updatedConfig = await config.save();

    res.status(200).json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete SLA configuration
// @route   DELETE /api/sla-configs/:id
// @access  Private (Admin only)
const deleteSlaConfig = async (req, res) => {
  try {
    const config = await SlaConfiguration.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ success: false, message: 'SLA Configuration not found' });
    }

    if (config.isDefault) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default SLA Configuration' });
    }

    await SlaConfiguration.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'SLA Configuration deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSlaConfigs,
  getDefaultSlaConfig,
  getSlaConfigById,
  createSlaConfig,
  updateSlaConfig,
  deleteSlaConfig
};
