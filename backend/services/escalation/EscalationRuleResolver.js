const EscalationRule = require('../../models/EscalationRule');

/**
 * EscalationRuleResolver encapsulates query resolving logic for Escalation Rules.
 */
class EscalationRuleResolver {
  /**
   * Resolves the active escalation rule for the given complaint.
   */
  async resolveRule(complaint) {
    if (!complaint.department || !complaint.category) {
      return null;
    }

    return await EscalationRule.findOne({
      departmentId: complaint.department,
      categoryId: complaint.category,
      isActive: true
    });
  }
}

module.exports = new EscalationRuleResolver();
