const BusinessCalendar = require('../models/BusinessCalendar');
const Category = require('../models/Category');
const Department = require('../models/Department');
const EscalationRule = require('../models/EscalationRule');
const Holiday = require('../models/Holiday');
const MaintenanceWindow = require('../models/MaintenanceWindow');
const BlackoutPeriod = require('../models/BlackoutPeriod');

/**
 * Extract exact date/time parts in the calendar's designated timezone.
 * @param {Date} date - The date to format
 * @param {String} timeZone - The designated timezone
 * @returns {Object} { year, month, day, hour, minute, second, dayOfWeek }
 */
function getDateTimeParts(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const partMap = {};
    parts.forEach(p => partMap[p.type] = p.value);
    
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'UTC', weekday: 'long' });
    const weekdayName = weekdayFormatter.format(date);
    const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const dayOfWeek = dayMap[weekdayName];

    return {
      year: parseInt(partMap.year, 10),
      month: parseInt(partMap.month, 10) - 1,
      day: parseInt(partMap.day, 10),
      hour: parseInt(partMap.hour, 10),
      minute: parseInt(partMap.minute, 10),
      second: parseInt(partMap.second, 10),
      dayOfWeek
    };
  } catch (err) {
    const isUtc = timeZone === 'UTC';
    return {
      year: isUtc ? date.getUTCFullYear() : date.getFullYear(),
      month: isUtc ? date.getUTCMonth() : date.getMonth(),
      day: isUtc ? date.getUTCDate() : date.getDate(),
      hour: isUtc ? date.getUTCHours() : date.getHours(),
      minute: isUtc ? date.getUTCMinutes() : date.getMinutes(),
      second: isUtc ? date.getUTCSeconds() : date.getSeconds(),
      dayOfWeek: isUtc ? date.getUTCDay() : date.getDay()
    };
  }
}

/**
 * Creates/converts a UTC Date object matching the designated year/month/day/hour/minute/second in timeZone.
 * @param {Number} year
 * @param {Number} month - 0-indexed
 * @param {Number} day
 * @param {Number} hour
 * @param {Number} minute
 * @param {Number} second
 * @param {String} timeZone
 * @returns {Date}
 */
function createDateInTimeZone(year, month, day, hour, minute, second, timeZone) {
  if (!timeZone || timeZone === 'UTC') {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  // Start with a UTC guess
  const guess = new Date(Date.UTC(year, month, day, hour, minute, second));
  const parts = getDateTimeParts(guess, timeZone);
  const guessLocal = new Date(Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second));
  const offset = guessLocal.getTime() - guess.getTime();
  
  const result = new Date(guess.getTime() - offset);
  // Refine check for DST transitions
  const checkParts = getDateTimeParts(result, timeZone);
  const checkLocal = new Date(Date.UTC(checkParts.year, checkParts.month, checkParts.day, checkParts.hour, checkParts.minute, checkParts.second));
  const targetLocal = new Date(Date.UTC(year, month, day, hour, minute, second));
  const diff = targetLocal.getTime() - checkLocal.getTime();
  if (diff !== 0) {
    return new Date(result.getTime() + diff);
  }
  return result;
}

/**
 * Checks if a given date is a holiday or weekend based on the calendar settings.
 * Deprecated for core calculations but kept for backward compatibility.
 * @param {Date} date - The date to check
 * @param {Object} calendar - BusinessCalendar document
 * @returns {Boolean}
 */
function isHolidayOrWeekend(date, calendar) {
  const parts = getDateTimeParts(date, calendar.timeZone);
  const day = parts.dayOfWeek; // 0 is Sunday, 1 is Monday, etc.
  if (!calendar.workingDays.includes(day)) {
    return true;
  }

  const year = parts.year;
  const month = parts.month;
  const dayOfMonth = parts.day;

  for (const holiday of calendar.holidays || []) {
    const hDate = new Date(holiday.date);
    const hParts = getDateTimeParts(hDate, calendar.timeZone);
    const hYear = hParts.year;
    const hMonth = hParts.month;
    const hDayOfMonth = hParts.day;
    if (holiday.isRecurring) {
      if (hMonth === month && hDayOfMonth === dayOfMonth) {
        return true;
      }
    } else {
      if (
        hYear === year &&
        hMonth === month &&
        hDayOfMonth === dayOfMonth
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves working hours for a given day, handling exceptions, in-document holidays,
 * external holiday collections, and weekend definitions.
 * @param {Date} date
 * @param {Object} calendar
 * @param {Array} dbHolidays
 * @returns {Object} { start, end, isWorking }
 */
function getWorkingHoursForDay(date, calendar, dbHolidays = []) {
  const parts = getDateTimeParts(date, calendar.timeZone);
  const year = parts.year;
  const month = parts.month;
  const dayOfMonth = parts.day;
  const dayOfWeek = parts.dayOfWeek;

  // 1. Check Exceptions in calendar
  if (calendar.exceptions && calendar.exceptions.length > 0) {
    for (const ex of calendar.exceptions) {
      const exDate = new Date(ex.date);
      const exParts = getDateTimeParts(exDate, calendar.timeZone);
      const exYear = exParts.year;
      const exMonth = exParts.month;
      const exDay = exParts.day;

      if (exYear === year && exMonth === month && exDay === dayOfMonth) {
        if (ex.startTime && ex.endTime && ex.startTime !== '00:00' && ex.endTime !== '00:00') {
          return { start: ex.startTime, end: ex.endTime, isWorking: true };
        } else {
          return { isWorking: false };
        }
      }
    }
  }

  // 2. Check in-document holidays
  if (calendar.holidays && calendar.holidays.length > 0) {
    for (const holiday of calendar.holidays) {
      const hDate = new Date(holiday.date);
      const hParts = getDateTimeParts(hDate, calendar.timeZone);
      const hMonth = hParts.month;
      const hDay = hParts.day;
      const hYear = hParts.year;

      if (holiday.isRecurring) {
        if (hMonth === month && hDay === dayOfMonth) {
          return { isWorking: false };
        }
      } else {
        if (hYear === year && hMonth === month && hDay === dayOfMonth) {
          return { isWorking: false };
        }
      }
    }
  }

  // 3. Check separate Holidays collection (dbHolidays)
  if (dbHolidays && dbHolidays.length > 0) {
    for (const holiday of dbHolidays) {
      const hDate = new Date(holiday.date);
      const hParts = getDateTimeParts(hDate, calendar.timeZone);
      const hMonth = hParts.month;
      const hDay = hParts.day;
      const hYear = hParts.year;

      if (holiday.recurring) {
        if (hMonth === month && hDay === dayOfMonth) {
          return { isWorking: false };
        }
      } else {
        if (hYear === year && hMonth === month && hDay === dayOfMonth) {
          return { isWorking: false };
        }
      }
    }
  }

  // 4. Check standard working days
  const workingDays = calendar.workingDays || [1, 2, 3, 4, 5];
  if (!workingDays.includes(dayOfWeek)) {
    return { isWorking: false };
  }

  // 5. Default working hours
  const start = (calendar.workingHours && calendar.workingHours.start) || '09:00';
  const end = (calendar.workingHours && calendar.workingHours.end) || '17:00';
  return { start, end, isWorking: true };
}

/**
 * Checks if there is an active blackout period on the specified date.
 * @param {Date} date
 * @param {String} [calendarId]
 * @returns {Promise<Boolean>}
 */
async function isBlackoutPeriod(date, calendarId = null) {
  const query = {
    startDate: { $lte: date },
    endDate: { $gte: date }
  };
  if (calendarId) {
    query.$or = [
      { calendarId: calendarId },
      { calendarId: null }
    ];
  } else {
    query.calendarId = null;
  }
  const count = await BlackoutPeriod.countDocuments(query);
  return count > 0;
}

/**
 * Resolves the calendar ID to use for a complaint based on priority rules.
 * @param {Object} complaint
 * @returns {Promise<Object>} Resolved BusinessCalendar document
 */
async function resolveCalendarForComplaint(complaint) {
  const getCalendarId = (field) => {
    if (!field) return null;
    return field._id || field;
  };

  if (!complaint) {
    return await BusinessCalendar.findOne({ isDefault: true });
  }

  // 1. Complaint Calendar
  const complaintCalId = getCalendarId(complaint.calendar);
  if (complaintCalId) {
    const cal = await BusinessCalendar.findById(complaintCalId);
    if (cal && cal.isActive) return cal;
  }

  // 2. Escalation Rule Calendar
  const ruleId = getCalendarId(complaint.escalationWorkflowId);
  if (ruleId) {
    const rule = await EscalationRule.findById(ruleId);
    const ruleCalId = rule ? getCalendarId(rule.calendar) : null;
    if (ruleCalId) {
      const cal = await BusinessCalendar.findById(ruleCalId);
      if (cal && cal.isActive) return cal;
    }
  }

  // 3. Category Calendar
  const catId = getCalendarId(complaint.category);
  if (catId) {
    const cat = await Category.findById(catId);
    const catCalId = cat ? getCalendarId(cat.calendar) : null;
    if (catCalId) {
      const cal = await BusinessCalendar.findById(catCalId);
      if (cal && cal.isActive) return cal;
    }
  }

  // 4. Department Calendar
  const deptId = getCalendarId(complaint.department);
  if (deptId) {
    const dept = await Department.findById(deptId);
    const deptCalId = dept ? getCalendarId(dept.calendar) : null;
    if (deptCalId) {
      const cal = await BusinessCalendar.findById(deptCalId);
      if (cal && cal.isActive) return cal;
    }
  }

  // 5. Default Calendar
  const defaultCal = await BusinessCalendar.findOne({ isDefault: true });
  if (defaultCal) return defaultCal;

  return null;
}

/**
 * Calculates the due date/time based on starting time, business duration, and business calendar.
 * @param {Date|String} startTime - Starting date/time
 * @param {Number} durationMinutes - SLA duration in minutes
 * @param {String|Object} [calendarIdOrObj] - Optional calendar ID or calendar document
 * @param {String} [departmentName] - Optional department name for maintenance filtering
 * @returns {Promise<Date>}
 */
async function calculateDueDate(startTime, durationMinutes, calendarIdOrObj = null, departmentName = null) {
  let calendar = null;
  if (calendarIdOrObj && typeof calendarIdOrObj === 'object' && calendarIdOrObj.name) {
    calendar = calendarIdOrObj;
  } else if (calendarIdOrObj) {
    calendar = await BusinessCalendar.findById(calendarIdOrObj);
  }

  if (!calendar) {
    calendar = await BusinessCalendar.findOne({ isDefault: true });
  }

  if (!calendar) {
    calendar = {
      name: 'Default Fallback Calendar',
      workingDays: [1, 2, 3, 4, 5],
      workingHours: { start: '09:00', end: '17:00' },
      holidays: [],
      maintenanceWindows: [],
      exceptions: [],
      timeZone: 'UTC'
    };
  }

  const calendarId = calendar._id || null;

  // Fetch external rules
  const dbHolidays = calendarId 
    ? await Holiday.find({ $or: [{ calendarId: calendarId }, { calendarId: null }] })
    : await Holiday.find({ calendarId: null });

  const dbMaintenance = await MaintenanceWindow.find({});
  const dbBlackouts = calendarId
    ? await BlackoutPeriod.find({ $or: [{ calendarId: calendarId }, { calendarId: null }] })
    : await BlackoutPeriod.find({ calendarId: null });

  let due = new Date(startTime);
  let minutesLeft = durationMinutes;

  let iterations = 0;
  const maxIterations = 5000;

  while (minutesLeft > 0 && iterations < maxIterations) {
    iterations++;

    // 1. Check if due is currently inside any Maintenance Window or Blackout Period
    let pausedTime = false;

    // Legacy maintenance windows
    for (const window of calendar.maintenanceWindows || []) {
      const start = new Date(window.start);
      const end = new Date(window.end);
      if (due >= start && due < end) {
        due = new Date(end);
        pausedTime = true;
        break;
      }
    }
    if (pausedTime) continue;

    // New Maintenance Windows
    for (const window of dbMaintenance) {
      const start = new Date(window.startDate);
      const end = new Date(window.endDate);
      const affectsDept = !window.affectedDepartments || 
                            window.affectedDepartments.length === 0 || 
                            (departmentName && window.affectedDepartments.includes(departmentName));
      if (affectsDept && due >= start && due < end) {
        due = new Date(end);
        pausedTime = true;
        break;
      }
    }
    if (pausedTime) continue;

    // Blackout Periods
    for (const blackout of dbBlackouts) {
      const start = new Date(blackout.startDate);
      const end = new Date(blackout.endDate);
      if (due >= start && due < end) {
        due = new Date(end);
        pausedTime = true;
        break;
      }
    }
    if (pausedTime) continue;

    // 2. Check if the current interval crosses into a Maintenance Window or Blackout Period
    let intersection = false;

    // Legacy maintenance windows intersection
    for (const window of calendar.maintenanceWindows || []) {
      const start = new Date(window.start);
      if (due < start && new Date(due.getTime() + minutesLeft * 60 * 1000) > start) {
        const minutesBefore = (start.getTime() - due.getTime()) / (60 * 1000);
        due = new Date(start);
        minutesLeft -= minutesBefore;
        intersection = true;
        break;
      }
    }
    if (intersection) continue;

    // New Maintenance Windows intersection
    for (const window of dbMaintenance) {
      const start = new Date(window.startDate);
      const affectsDept = !window.affectedDepartments || 
                            window.affectedDepartments.length === 0 || 
                            (departmentName && window.affectedDepartments.includes(departmentName));
      if (affectsDept && due < start && new Date(due.getTime() + minutesLeft * 60 * 1000) > start) {
        const minutesBefore = (start.getTime() - due.getTime()) / (60 * 1000);
        due = new Date(start);
        minutesLeft -= minutesBefore;
        intersection = true;
        break;
      }
    }
    if (intersection) continue;

    // Blackout Periods intersection
    for (const blackout of dbBlackouts) {
      const start = new Date(blackout.startDate);
      if (due < start && new Date(due.getTime() + minutesLeft * 60 * 1000) > start) {
        const minutesBefore = (start.getTime() - due.getTime()) / (60 * 1000);
        due = new Date(start);
        minutesLeft -= minutesBefore;
        intersection = true;
        break;
      }
    }
    if (intersection) continue;

    // 3. Resolve the working hours for the day of 'due'
    const workingHours = getWorkingHoursForDay(due, calendar, dbHolidays);

    if (!workingHours.isWorking) {
      const [startH, startM] = ((calendar.workingHours && calendar.workingHours.start) || '09:00').split(':').map(Number);
      const dueParts = getDateTimeParts(due, calendar.timeZone);
      due = createDateInTimeZone(dueParts.year, dueParts.month, dueParts.day + 1, startH, startM, 0, calendar.timeZone);
      continue;
    }

    const [startH, startM] = workingHours.start.split(':').map(Number);
    const [endH, endM] = workingHours.end.split(':').map(Number);

    const dueParts = getDateTimeParts(due, calendar.timeZone);
    const businessStart = createDateInTimeZone(dueParts.year, dueParts.month, dueParts.day, startH, startM, 0, calendar.timeZone);
    const businessEnd = createDateInTimeZone(dueParts.year, dueParts.month, dueParts.day, endH, endM, 0, calendar.timeZone);

    if (due < businessStart) {
      due = businessStart;
    }

    if (due >= businessEnd) {
      const [nextDayH, nextDayM] = ((calendar.workingHours && calendar.workingHours.start) || '09:00').split(':').map(Number);
      const nextDayParts = getDateTimeParts(due, calendar.timeZone);
      due = createDateInTimeZone(nextDayParts.year, nextDayParts.month, nextDayParts.day + 1, nextDayH, nextDayM, 0, calendar.timeZone);
      continue;
    }

    const minutesInWorkingDayLeft = (businessEnd.getTime() - due.getTime()) / (60 * 1000);

    if (minutesLeft <= minutesInWorkingDayLeft) {
      due = new Date(due.getTime() + minutesLeft * 60 * 1000);
      minutesLeft = 0;
    } else {
      minutesLeft -= minutesInWorkingDayLeft;
      const [nextDayH, nextDayM] = ((calendar.workingHours && calendar.workingHours.start) || '09:00').split(':').map(Number);
      const nextDayParts = getDateTimeParts(due, calendar.timeZone);
      due = createDateInTimeZone(nextDayParts.year, nextDayParts.month, nextDayParts.day + 1, nextDayH, nextDayM, 0, calendar.timeZone);
    }
  }

  return due;
}

/**
 * Calculates a business due date wrapping calculateDueDate with duration in hours.
 * @param {Date|String} startDate
 * @param {Number} durationHours
 * @param {String|Object} calendar
 * @returns {Promise<Date>}
 */
async function calculateBusinessTime(startDate, durationHours, calendar) {
  const durationMinutes = Math.round(durationHours * 60);
  return await calculateDueDate(startDate, durationMinutes, calendar);
}

/**
 * Calculates the total number of business minutes accumulated between two dates.
 * @param {Date|String} startDate
 * @param {Date|String} endDate
 * @param {String|Object} [calendarIdOrObj]
 * @param {String} [departmentName]
 * @returns {Promise<Number>}
 */
async function calculateBusinessMinutes(startDate, endDate, calendarIdOrObj = null, departmentName = null) {
  let calendar = null;
  if (calendarIdOrObj && typeof calendarIdOrObj === 'object' && calendarIdOrObj.name) {
    calendar = calendarIdOrObj;
  } else if (calendarIdOrObj) {
    calendar = await BusinessCalendar.findById(calendarIdOrObj);
  }

  if (!calendar) {
    calendar = await BusinessCalendar.findOne({ isDefault: true });
  }

  if (!calendar) {
    calendar = {
      name: 'Default Fallback Calendar',
      workingDays: [1, 2, 3, 4, 5],
      workingHours: { start: '09:00', end: '17:00' },
      holidays: [],
      maintenanceWindows: [],
      exceptions: [],
      timeZone: 'UTC'
    };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) return 0;

  const calendarId = calendar._id || null;

  // Fetch external rules
  const dbHolidays = calendarId 
    ? await Holiday.find({ $or: [{ calendarId: calendarId }, { calendarId: null }] })
    : await Holiday.find({ calendarId: null });

  const dbMaintenance = await MaintenanceWindow.find({});
  const dbBlackouts = calendarId
    ? await BlackoutPeriod.find({ $or: [{ calendarId: calendarId }, { calendarId: null }] })
    : await BlackoutPeriod.find({ calendarId: null });

  let totalMinutes = 0;
  let current = new Date(start);

  const maxIterations = 5000;
  let iterations = 0;

  while (current < end && iterations < maxIterations) {
    iterations++;

    // 1. Check if current is in Maintenance Window or Blackout
    let pausedTime = false;

    for (const window of calendar.maintenanceWindows || []) {
      const wStart = new Date(window.start);
      const wEnd = new Date(window.end);
      if (current >= wStart && current < wEnd) {
        current = new Date(Math.min(wEnd.getTime(), end.getTime()));
        pausedTime = true;
        break;
      }
    }
    if (pausedTime) continue;

    for (const window of dbMaintenance) {
      const wStart = new Date(window.startDate);
      const wEnd = new Date(window.endDate);
      const affectsDept = !window.affectedDepartments || 
                            window.affectedDepartments.length === 0 || 
                            (departmentName && window.affectedDepartments.includes(departmentName));
      if (affectsDept && current >= wStart && current < wEnd) {
        current = new Date(Math.min(wEnd.getTime(), end.getTime()));
        pausedTime = true;
        break;
      }
    }
    if (pausedTime) continue;

    for (const blackout of dbBlackouts) {
      const bStart = new Date(blackout.startDate);
      const bEnd = new Date(blackout.endDate);
      if (current >= bStart && current < bEnd) {
        current = new Date(Math.min(bEnd.getTime(), end.getTime()));
        pausedTime = true;
        break;
      }
    }
    if (pausedTime) continue;

    // Check if next Maintenance Window or Blackout intersects before the day ends
    let nextPauseStart = null;
    for (const window of calendar.maintenanceWindows || []) {
      const wStart = new Date(window.start);
      if (current < wStart && wStart < end) {
        if (!nextPauseStart || wStart < nextPauseStart) nextPauseStart = wStart;
      }
    }
    for (const window of dbMaintenance) {
      const wStart = new Date(window.startDate);
      const affectsDept = !window.affectedDepartments || 
                            window.affectedDepartments.length === 0 || 
                            (departmentName && window.affectedDepartments.includes(departmentName));
      if (affectsDept && current < wStart && wStart < end) {
        if (!nextPauseStart || wStart < nextPauseStart) nextPauseStart = wStart;
      }
    }
    for (const blackout of dbBlackouts) {
      const bStart = new Date(blackout.startDate);
      if (current < bStart && bStart < end) {
        if (!nextPauseStart || bStart < nextPauseStart) nextPauseStart = bStart;
      }
    }

    const workingHours = getWorkingHoursForDay(current, calendar, dbHolidays);

    if (!workingHours.isWorking) {
      const [startH, startM] = ((calendar.workingHours && calendar.workingHours.start) || '09:00').split(':').map(Number);
      const currParts = getDateTimeParts(current, calendar.timeZone);
      current = createDateInTimeZone(currParts.year, currParts.month, currParts.day + 1, startH, startM, 0, calendar.timeZone);
      continue;
    }

    const [startH, startM] = workingHours.start.split(':').map(Number);
    const [endH, endM] = workingHours.end.split(':').map(Number);

    const currParts = getDateTimeParts(current, calendar.timeZone);
    const businessStart = createDateInTimeZone(currParts.year, currParts.month, currParts.day, startH, startM, 0, calendar.timeZone);
    const businessEnd = createDateInTimeZone(currParts.year, currParts.month, currParts.day, endH, endM, 0, calendar.timeZone);

    if (current < businessStart) {
      current = businessStart;
    }

    if (current >= businessEnd) {
      const [nextDayH, nextDayM] = ((calendar.workingHours && calendar.workingHours.start) || '09:00').split(':').map(Number);
      const nextDayParts = getDateTimeParts(current, calendar.timeZone);
      current = createDateInTimeZone(nextDayParts.year, nextDayParts.month, nextDayParts.day + 1, nextDayH, nextDayM, 0, calendar.timeZone);
      continue;
    }

    let limit = new Date(Math.min(businessEnd.getTime(), end.getTime()));
    if (nextPauseStart && nextPauseStart < limit) {
      limit = nextPauseStart;
    }

    if (limit > current) {
      totalMinutes += (limit.getTime() - current.getTime()) / (60 * 1000);
      current = limit;
    }
  }

  return Math.round(totalMinutes);
}

module.exports = {
  calculateDueDate,
  isHolidayOrWeekend,
  resolveCalendarForComplaint,
  calculateBusinessTime,
  calculateBusinessMinutes,
  isBlackoutPeriod,
  getWorkingHoursForDay
};
