const AssignmentEngine = require('./escalation/AssignmentEngine');

module.exports = {
  autoAssignComplaint: async (complaint, strategy) => {
    return await AssignmentEngine.assignComplaint(complaint, strategy);
  },
  assignRoundRobin: async (complaint, eligibleUsers, key) => {
    return await AssignmentEngine.assignRoundRobin(complaint, eligibleUsers, key);
  },
  assignLeastTickets: async (complaint, eligibleUsers) => {
    return await AssignmentEngine.assignLeastTickets(complaint, eligibleUsers);
  },
  assignSkillBased: async (complaint, eligibleUsers) => {
    return await AssignmentEngine.assignSkillBased(complaint, eligibleUsers);
  }
};
