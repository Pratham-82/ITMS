const calendarService = require('../calendarService');

/**
 * CalendarEngine standardizes all business hour, holiday, blackout, timezone,
 * and exception calculations across the CMS application.
 */
module.exports = {
  /**
   * Calculates a business due date wrapping calculateDueDate with duration in hours.
   * @param {Date|String} startDate
   * @param {Number} durationHours
   * @param {String|Object} calendar
   * @returns {Promise<Date>}
   */
  calculateBusinessTime: calendarService.calculateBusinessTime,

  /**
   * Calculates the total number of business minutes accumulated between two dates.
   * @param {Date|String} startDate
   * @param {Date|String} endDate
   * @param {String|Object} [calendarIdOrObj]
   * @param {String} [departmentName]
   * @returns {Promise<Number>}
   */
  calculateBusinessMinutes: calendarService.calculateBusinessMinutes,

  /**
   * Resolves the calendar ID to use for a complaint based on priority rules.
   * @param {Object} complaint
   * @returns {Promise<Object>} Resolved BusinessCalendar document
   */
  resolveCalendarForComplaint: calendarService.resolveCalendarForComplaint,

  /**
   * Calculates the due date/time based on starting time, business duration, and business calendar.
   * @param {Date|String} startTime
   * @param {Number} durationMinutes
   * @param {String|Object} [calendarIdOrObj]
   * @param {String} [departmentName]
   * @returns {Promise<Date>}
   */
  calculateDueDate: calendarService.calculateDueDate,

  /**
   * Checks if there is an active blackout period on the specified date.
   * @param {Date} date
   * @param {String} [calendarId]
   * @returns {Promise<Boolean>}
   */
  isBlackoutPeriod: calendarService.isBlackoutPeriod,

  /**
   * Checks if a given date is a holiday or weekend based on the calendar settings.
   * @param {Date} date
   * @param {Object} calendar
   * @returns {Boolean}
   */
  isHolidayOrWeekend: calendarService.isHolidayOrWeekend,

  /**
   * Resolves working hours for a given day, handling exceptions, in-document holidays,
   * external holiday collections, and weekend definitions.
   * @param {Date} date
   * @param {Object} calendar
   * @param {Array} dbHolidays
   * @returns {Object} { start, end, isWorking }
   */
  getWorkingHoursForDay: calendarService.getWorkingHoursForDay
};
