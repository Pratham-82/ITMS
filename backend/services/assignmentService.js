const AssignmentEngine = require('./escalation/AssignmentEngine');

module.exports = {
  calculateWorkloadScore: async (user) => {
    return await AssignmentEngine.calculateWorkloadScore(user);
  },
  autoAssign: async (complaint) => {
    const result = await AssignmentEngine.assignComplaint(complaint, 'workload');
    return result ? result.assignedUser : null;
  },
  getBalancingSuggestions: async (departmentName, groupId = null) => {
    return await AssignmentEngine.getBalancingSuggestions(departmentName, groupId);
  }
};
