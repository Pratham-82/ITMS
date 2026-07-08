const mongoose = require('mongoose');
const calendarService = require('../services/calendarService');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/apexresolve_mega-corp');
    console.log('Connected to mega-corp.');

    const calendar = await mongoose.connection.db.collection('businesscalendars').findOne({});
    console.log('Using calendar:', calendar.name, 'timeZone:', calendar.timeZone);

    // Test cases (UTC times)
    const testCases = [
      '2026-07-02T07:30:00.000Z', // Before business hours (09:00)
      '2026-07-02T09:15:00.000Z', // During business hours
      '2026-07-02T12:00:00.000Z', // During business hours
      '2026-07-02T15:30:00.000Z', // During business hours, but less than 4 hours left (business day ends at 17:00)
      '2026-07-02T18:00:00.000Z', // After business hours
    ];

    const durationMinutes = 4 * 60; // 4 hours

    for (const tc of testCases) {
      const start = new Date(tc);
      const due = await calendarService.calculateDueDate(start, durationMinutes, calendar);
      console.log(`Start: ${tc} -> Due: ${due.toISOString()}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
