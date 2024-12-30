import { google } from 'googleapis';
// Example function definitions array:
const functions = [
    {
        name: "getAvailableTimeSlots",
        description: "Retrieves available time slots from a Google Calendar based on input parameters",
        parameters: {
            type: "object",
            properties: {
                calendarId: {
                    type: "string",
                    description: "The ID of the calendar to check, e.g., 'primary'"
                },
                startDate: {
                    type: "string",
                    description: "The start date for checking availability, in ISO 8601 format"
                },
                endDate: {
                    type: "string",
                    description: "The end date for checking availability, in ISO 8601 format"
                },
                durationMinutes: {
                    type: "number",
                    description: "The duration of each desired time slot in minutes"
                }
            },
            required: ["calendarId", "startDate", "endDate", "durationMinutes"]
        }
    },
    {
        name: "bookTimeSlot",
        description: "Books a time slot in a Google Calendar, ensuring no conflicts with existing events",
        parameters: {
            type: "object",
            properties: {
                calendarId: {
                    type: "string",
                    description: "The ID of the calendar to book the time slot in"
                },
                startDate: {
                    type: "string",
                    description: "The start date for booking the time slot, in ISO 8601 format"
                },
                endDate: {
                    type: "string",
                    description: "The end date for booking the time slot, in ISO 8601 format"
                },
                durationMinutes: {
                    type: "number",
                    description: "The duration of the time slot to book, in minutes"
                },
                eventSummary: {
                    type: "string",
                    description: "The summary or title of the event"
                },
                eventDescription: {
                    type: "string",
                    description: "The description of the event"
                }
            },
            required: ["calendarId", "startDate", "endDate", "durationMinutes", "eventSummary", "eventDescription"]
        }
    }
];

//Local function to get current date and time
  /**
 * Gets available time slots from Google Calendar.
 * @param {string} calendarId - The ID of the calendar to check (e.g., 'primary').
 * @param {string} timeZone - The time zone (e.g., 'America/Los_Angeles').
 * @param {Date} startDate - The start date for the availability search.
 * @param {Date} endDate - The end date for the availability search.
 * @param {number} durationMinutes - The desired duration of the time slot in minutes.
 * @returns {Promise<Array>} - A list of available time slots.
 */
  async function getAvailableTimeSlots(calendarId, startDate, endDate, durationMinutes) {
    

    console.log(`Checking availability for calendar '${calendarId}' from ${startDate} to ${endDate}...`);
    const timeZone = 'America/Vancouver'; // Hardcoded Vancouver timezone
    const auth = new google.auth.GoogleAuth({
        keyFile: 'winter-environs-439018-r7-bd780b75309f.json', // Path to your service account key file
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Fetch busy times from the calendar
    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin: startDate,
            timeMax: endDate,
            timeZone,
            items: [{ id: calendarId }],
        },
    });

    const busySlots = response.data.calendars[calendarId]?.busy || [];
    const availableSlots = [];

    let currentTime = new Date(startDate);

    while (currentTime < endDate) {
        const nextTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
        if (nextTime > endDate) break;

        // Check if the time slot is free
        const isFree = !busySlots.some(slot => {
            const slotStart = new Date(slot.start);
            const slotEnd = new Date(slot.end);
            return currentTime < slotEnd && nextTime > slotStart;
        });

        if (isFree) {
            availableSlots.push({
                start: currentTime.toISOString(),
            });
        }

        currentTime = nextTime; // Move to the next potential time slot
    }

    // Limit to the first 10 slots
    const limitedSlots = availableSlots.slice(0, 5);

    // Convert available start times to a string format
    const slotsString = limitedSlots.map(slot => new Date(slot.start).toLocaleString('en-US', { timeZone: 'America/Vancouver' })).join(', ');

    console.log(`Available time slots: ${slotsString}`);
    return slotsString;
}




  async function bookTimeSlot(calendarId, startDate, endDate, durationMinutes, eventSummary, eventDescription) {
    console.log(`Booking a time slot in calendar '${calendarId}' from ${startDate} to ${endDate}...`);



    console.log(`Booking a time slot in calendar '${calendarId}' from ${startDate} to ${endDate}...`);

    const timeZone = 'America/Vancouver'; // Hardcoded Vancouver timezone

    // Authenticate with Google Calendar API
    const auth = new google.auth.GoogleAuth({
        keyFile: 'winter-environs-439018-r7-bd780b75309f.json', // Path to your service account key file
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Fetch busy times from the calendar
    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin: startDate,
            timeMax: endDate,
            timeZone,
            items: [{ id: calendarId }],
        },
    });

    const busySlots = response.data.calendars[calendarId]?.busy || [];
    let currentTime = new Date(startDate);

    while (currentTime < endDate) {
        const nextTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
        if (nextTime > endDate) break;

        // Check if the time slot is free
        const isFree = !busySlots.some(slot => {
            const slotStart = new Date(slot.start);
            const slotEnd = new Date(slot.end);
            return currentTime < slotEnd && nextTime > slotStart;
        });

        if (isFree) {
            console.log(`Found free time slot: ${currentTime.toISOString()} to ${nextTime.toISOString()}`);

            // Create an event in the calendar
            const event = {
                summary: eventSummary,
                description: eventDescription,
                start: {
                    dateTime: currentTime.toISOString(),
                    timeZone,
                },
                end: {
                    dateTime: nextTime.toISOString(),
                    timeZone,
                },
            };

            try {
                const insertResponse = await calendar.events.insert({
                    calendarId,
                    requestBody: event,
                });
                console.log(`Successfully booked time slot: ${insertResponse.data.htmlLink}`);
                return insertResponse.data; // Return the created event details
            } catch (error) {
                console.error('Failed to book the time slot:', error);
                throw new Error('Failed to book the time slot');
            }
        }

        currentTime = nextTime; // Move to the next potential time slot
    }

    console.log('No available time slots found within the specified range.');
    return null; // Indicate no slots were booked
}


export { functions, getAvailableTimeSlots, bookTimeSlot };