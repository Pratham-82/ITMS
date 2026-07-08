// SLA Templates
export const slaTemplates = {
  standard: {
    name: 'Standard Support SLA',
    priorities: {
      Critical: { responseSlaMinutes: 30, resolutionSlaMinutes: 360 },
      High: { responseSlaMinutes: 120, resolutionSlaMinutes: 720 },
      Medium: { responseSlaMinutes: 360, resolutionSlaMinutes: 1440 },
      Low: { responseSlaMinutes: 720, resolutionSlaMinutes: 4320 }
    },
    breachActions: {
      responseSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED'],
      resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'INCREASE_RISK_SCORE']
    },
    multiBreachRules: [
      { breachCount: 1, action: 'NOTIFY_MANAGER' },
      { breachCount: 2, action: 'PRIORITY_UPGRADE' },
      { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' }
    ],
    riskScoreRules: {
      responseBreachIncrease: 10,
      resolutionBreachIncrease: 20,
      reopenIncrease: 15,
      escalationIncrease: 10,
      lowRatingIncrease: 15,
      criticalPriorityIncrease: 20
    }
  },
  vip: {
    name: 'VIP Premier SLA',
    priorities: {
      Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 120 },
      High: { responseSlaMinutes: 30, resolutionSlaMinutes: 240 },
      Medium: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
      Low: { responseSlaMinutes: 120, resolutionSlaMinutes: 720 }
    },
    breachActions: {
      responseSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'PRIORITY_UPGRADE', 'MARK_ATTENTION'],
      resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'NOTIFY_DEPT_HEAD', 'LEVEL_ESCALATION', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD', 'PRIORITY_UPGRADE', 'EXECUTIVE_ESCALATE']
    },
    multiBreachRules: [
      { breachCount: 1, action: 'NOTIFY_MANAGER' },
      { breachCount: 2, action: 'PRIORITY_UPGRADE' },
      { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' },
      { breachCount: 4, action: 'EXECUTIVE_ESCALATE' }
    ],
    riskScoreRules: {
      responseBreachIncrease: 20,
      resolutionBreachIncrease: 40,
      reopenIncrease: 30,
      escalationIncrease: 20,
      lowRatingIncrease: 25,
      criticalPriorityIncrease: 35
    }
  },
  critical: {
    name: 'Critical Incident SLA',
    priorities: {
      Critical: { responseSlaMinutes: 10, resolutionSlaMinutes: 60 },
      High: { responseSlaMinutes: 15, resolutionSlaMinutes: 120 },
      Medium: { responseSlaMinutes: 30, resolutionSlaMinutes: 240 },
      Low: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 }
    },
    breachActions: {
      responseSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'NOTIFY_DEPT_HEAD', 'PRIORITY_UPGRADE', 'MARK_ATTENTION', 'INCREASE_RISK_SCORE'],
      resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'NOTIFY_DEPT_HEAD', 'LEVEL_ESCALATION', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD', 'PRIORITY_UPGRADE', 'EXECUTIVE_ESCALATE']
    },
    multiBreachRules: [
      { breachCount: 1, action: 'NOTIFY_MANAGER' },
      { breachCount: 2, action: 'PRIORITY_UPGRADE' },
      { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' },
      { breachCount: 4, action: 'EXECUTIVE_ESCALATE' },
      { breachCount: 5, action: 'CRITICAL_INCIDENT_FLAG' }
    ],
    riskScoreRules: {
      responseBreachIncrease: 30,
      resolutionBreachIncrease: 50,
      reopenIncrease: 35,
      escalationIncrease: 25,
      lowRatingIncrease: 30,
      criticalPriorityIncrease: 40
    }
  },
  government: {
    name: 'Government SLA Matrix',
    priorities: {
      Critical: { responseSlaMinutes: 120, resolutionSlaMinutes: 1440 },
      High: { responseSlaMinutes: 240, resolutionSlaMinutes: 2880 },
      Medium: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 },
      Low: { responseSlaMinutes: 960, resolutionSlaMinutes: 8640 }
    },
    breachActions: {
      responseSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED'],
      resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_DEPT_HEAD', 'LEVEL_ESCALATION']
    },
    multiBreachRules: [
      { breachCount: 1, action: 'NOTIFY_MANAGER' },
      { breachCount: 2, action: 'NOTIFY_DEPT_HEAD' }
    ],
    riskScoreRules: {
      responseBreachIncrease: 5,
      resolutionBreachIncrease: 10,
      reopenIncrease: 10,
      escalationIncrease: 5,
      lowRatingIncrease: 10,
      criticalPriorityIncrease: 10
    }
  },
  enterprise: {
    name: 'Enterprise Support SLA',
    priorities: {
      Critical: { responseSlaMinutes: 30, resolutionSlaMinutes: 480 },
      High: { responseSlaMinutes: 60, resolutionSlaMinutes: 960 },
      Medium: { responseSlaMinutes: 120, resolutionSlaMinutes: 1440 },
      Low: { responseSlaMinutes: 240, resolutionSlaMinutes: 2880 }
    },
    breachActions: {
      responseSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER'],
      resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'LEVEL_ESCALATION', 'INCREASE_RISK_SCORE']
    },
    multiBreachRules: [
      { breachCount: 1, action: 'NOTIFY_MANAGER' },
      { breachCount: 2, action: 'NOTIFY_DEPT_HEAD' },
      { breachCount: 3, action: 'EXECUTIVE_ESCALATE' }
    ],
    riskScoreRules: {
      responseBreachIncrease: 15,
      resolutionBreachIncrease: 25,
      reopenIncrease: 20,
      escalationIncrease: 15,
      lowRatingIncrease: 20,
      criticalPriorityIncrease: 25
    }
  }
};

// Business Calendar Templates
export const calendarTemplates = {
  standardOffice: {
    name: 'Standard Office Calendar',
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    workingHours: { start: '09:00', end: '17:00' },
    holidays: [
      { name: 'New Year\'s Day', date: '2026-01-01' },
      { name: 'Independence Day', date: '2026-07-04' },
      { name: 'Christmas Day', date: '2026-12-25' }
    ],
    exceptions: []
  },
  support247: {
    name: '24x7 Continuous Operations',
    workingDays: [0, 1, 2, 3, 4, 5, 6], // Sun-Sat
    workingHours: { start: '00:00', end: '24:00' },
    holidays: [],
    exceptions: []
  },
  governmentOffice: {
    name: 'Government Standard Hours',
    workingDays: [1, 2, 3, 4, 5],
    workingHours: { start: '09:00', end: '16:00' },
    holidays: [
      { name: 'New Year\'s Day', date: '2026-01-01' },
      { name: 'Memorial Day', date: '2026-05-25' },
      { name: 'Independence Day', date: '2026-07-04' },
      { name: 'Labor Day', date: '2026-09-07' },
      { name: 'Thanksgiving Day', date: '2026-11-26' },
      { name: 'Christmas Day', date: '2026-12-25' }
    ],
    exceptions: []
  },
  university: {
    name: 'University Administration Hours',
    workingDays: [1, 2, 3, 4, 5],
    workingHours: { start: '08:00', end: '16:30' },
    holidays: [
      { name: 'New Year\'s Day', date: '2026-01-01' },
      { name: 'Spring Break Start', date: '2026-03-09' },
      { name: 'Thanksgiving Break', date: '2026-11-26' },
      { name: 'Christmas Break', date: '2026-12-24' }
    ],
    exceptions: []
  },
  itOps: {
    name: 'IT Ops Extended Coverage',
    workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    workingHours: { start: '08:00', end: '18:00' },
    holidays: [
      { name: 'New Year\'s Day', date: '2026-01-01' },
      { name: 'Labor Day', date: '2026-09-07' },
      { name: 'Christmas Day', date: '2026-12-25' }
    ],
    exceptions: []
  }
};

// Escalation Templates
export const escalationTemplates = {
  standard: {
    name: 'Standard Escalation Template',
    rules: [
      { level: 1, role: 'agent', cooldownMinutes: 120 },
      { level: 2, role: 'lead', cooldownMinutes: 240 },
      { level: 3, role: 'manager', cooldownMinutes: 480 }
    ],
    notificationChannels: ['email', 'in-app'],
    triggerEvents: ['responseSlaBreach', 'resolutionSlaBreach']
  },
  vip: {
    name: 'VIP Escalation Template',
    rules: [
      { level: 1, role: 'lead', cooldownMinutes: 30 },
      { level: 2, role: 'manager', cooldownMinutes: 60 },
      { level: 3, role: 'director', cooldownMinutes: 120 }
    ],
    notificationChannels: ['email', 'in-app', 'sms'],
    triggerEvents: ['responseSlaBreach', 'resolutionSlaBreach', 'highRiskAlert']
  },
  critical: {
    name: 'Critical Incident Escalation',
    rules: [
      { level: 1, role: 'manager', cooldownMinutes: 15 },
      { level: 2, role: 'director', cooldownMinutes: 30 }
    ],
    notificationChannels: ['email', 'in-app', 'sms', 'whatsapp'],
    triggerEvents: ['responseSlaBreach', 'resolutionSlaBreach', 'repeatedBreach', 'criticalRisk']
  },
  management: {
    name: 'Management Direct Escalation',
    rules: [
      { level: 1, role: 'lead', cooldownMinutes: 60 },
      { level: 2, role: 'manager', cooldownMinutes: 120 }
    ],
    notificationChannels: ['email', 'in-app'],
    triggerEvents: ['responseSlaBreach']
  }
};
