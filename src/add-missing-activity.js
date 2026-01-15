const fs = require('fs').promises;
const path = require('path');

class ActivityAdder {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'docs', 'data');
    }

    async addActivity(year, activityData) {
        try {
            const dataFile = path.join(this.dataDir, `running-data-${year}.json`);

            // Read existing data
            const rawData = await fs.readFile(dataFile, 'utf8');
            const data = JSON.parse(rawData);

            // Create activity object with calculated fields
            const activity = this.createActivityObject(activityData, year);

            // Check if activity already exists by date
            const existingIndex = data.activities.findIndex(a => a.date === activityData.date);
            if (existingIndex !== -1) {
                console.log(`Activity for ${activityData.date} already exists. Replacing...`);
                data.activities[existingIndex] = activity;
            } else {
                data.activities.push(activity);
            }

            // Sort by date (newest first)
            data.activities.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Recalculate summary
            data.summary = this.generateSummary(data.activities);
            data.totalActivities = data.activities.length;

            // Update last modified timestamp
            data.lastUpdated = new Date().toISOString();

            // Write back to file
            await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
            console.log(`✓ Activity added for ${activityData.date} to running-data-${year}.json`);
            console.log(`  Distance: ${activity.distanceKm} km`);
            console.log(`  Total activities for ${year}: ${data.totalActivities}`);

            return true;
        } catch (error) {
            console.error('Error adding activity:', error);
            throw error;
        }
    }

    createActivityObject(data, year) {
        const distanceKm = parseFloat(data.distanceKm);
        const distanceMiles = (distanceKm * 0.621371).toFixed(2);
        const movingTime = parseInt(data.movingTime);
        const totalElevationGain = parseFloat(data.totalElevationGain || 0);
        const averageHeartrate = parseInt(data.averageHeartrate || 0);
        const maxHeartrate = parseInt(data.maxHeartrate || 0);

        // Calculate pace
        const speedMph = (distanceMiles * 3600) / movingTime;
        const speedMps = speedMph / 2.237;
        const averagePaceMinMile = this.speedToPace(speedMph, 'mile');
        const averagePaceMinKm = this.speedToPace(speedMph * 1.60934, 'km');

        // Parse date to get day info
        const dateObj = new Date(data.date + 'T12:00:00Z');
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const month = dateObj.toLocaleDateString('en-US', { month: 'long' });
        const quarterYear = Math.ceil((dateObj.getMonth() + 1) / 3);
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

        const season = this.getSeason(dateObj.getMonth());

        return {
            id: Math.floor(Math.random() * 10000000000),
            date: data.date,
            distance: distanceKm * 1000, // in meters
            distanceMiles: distanceMiles,
            distanceKm: distanceKm.toFixed(2),
            movingTime: movingTime,
            elapsedTime: movingTime,
            totalElevationGain: totalElevationGain,
            averageSpeed: speedMps,
            maxSpeed: speedMps * 1.2, // estimate
            averagePaceMinMile: averagePaceMinMile,
            averagePaceMinKm: averagePaceMinKm,
            averageHeartrate: averageHeartrate,
            maxHeartrate: maxHeartrate,
            sufferScore: Math.round((averageHeartrate / 200) * 100) || 0,
            kudosCount: 0,
            startLatLng: [],
            endLatLng: [],
            city: null,
            state: null,
            country: null,
            gear: null,
            pacePerMile: (movingTime / parseFloat(distanceMiles)) * 60,
            elevationPerMile: totalElevationGain / parseFloat(distanceMiles) || 0,
            speedMph: speedMph,
            weekday: weekday,
            month: month,
            year: year,
            quarterYear: quarterYear,
            isWeekend: isWeekend,
            season: season
        };
    }

    speedToPace(speedMph, unit) {
        const speedPerUnit = speedMph; // already in the target unit
        if (speedPerUnit === 0) return 'N/A';

        const minutesPerUnit = 60 / speedPerUnit;
        const minutes = Math.floor(minutesPerUnit);
        const seconds = Math.round((minutesPerUnit - minutes) * 60);

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    getSeason(month) {
        if (month >= 2 && month <= 4) return 'Spring';
        if (month >= 5 && month <= 7) return 'Summer';
        if (month >= 8 && month <= 10) return 'Fall';
        return 'Winter';
    }

    generateSummary(activities) {
        if (!activities || activities.length === 0) {
            return {
                totalDistance: '0.00',
                totalTimeHours: '0.0',
                totalElevationGain: '0',
                averageDistance: '0.00',
                averagePace: 'N/A',
                activitiesPerWeek: '0'
            };
        }

        const totalDistance = activities.reduce((sum, a) => sum + parseFloat(a.distanceKm), 0);
        const totalTime = activities.reduce((sum, a) => sum + a.movingTime, 0);
        const totalElevation = activities.reduce((sum, a) => sum + a.totalElevationGain, 0);
        const averageDistance = totalDistance / activities.length;
        const averagePaceSeconds = totalTime / activities.length / parseFloat(activities[0].distanceKm);
        const averagePaceMinutes = Math.floor(averagePaceSeconds / 60);
        const averagePaceSecRem = Math.round(averagePaceSeconds % 60);

        return {
            totalDistance: totalDistance.toFixed(2),
            totalTimeHours: (totalTime / 3600).toFixed(1),
            totalElevationGain: Math.round(totalElevation).toString(),
            averageDistance: averageDistance.toFixed(2),
            averagePace: `${averagePaceMinutes}:${averagePaceSecRem.toString().padStart(2, '0')}`,
            activitiesPerWeek: (activities.length / 52).toFixed(1),
            dateRange: {
                start: activities[activities.length - 1].date,
                end: activities[0].date
            },
            yearToDateStats: {
                totalDays: this.calculateTotalDays(activities),
                activeDays: activities.length,
                averageDistancePerRun: averageDistance.toFixed(2),
                totalRuns: activities.length,
                longestRun: Math.max(...activities.map(a => parseFloat(a.distanceKm))).toFixed(2)
            }
        };
    }

    calculateTotalDays(activities) {
        if (activities.length === 0) return 0;
        const firstDate = new Date(activities[activities.length - 1].date);
        const lastDate = new Date(activities[0].date);
        return Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
    }
}

// Main execution
const year = process.env.ACTIVITY_YEAR;
const activityData = {
    date: process.env.ACTIVITY_DATE,
    distanceKm: process.env.ACTIVITY_DISTANCE,
    movingTime: process.env.ACTIVITY_TIME,
    totalElevationGain: process.env.ACTIVITY_ELEVATION || 0,
    averageHeartrate: process.env.ACTIVITY_HR || 0,
    maxHeartrate: process.env.ACTIVITY_MAX_HR || 0
};

if (!year || !activityData.date || !activityData.distanceKm || !activityData.movingTime) {
    console.error('Missing required environment variables:');
    console.error('  ACTIVITY_YEAR, ACTIVITY_DATE, ACTIVITY_DISTANCE, ACTIVITY_TIME');
    process.exit(1);
}

const adder = new ActivityAdder();
adder.addActivity(parseInt(year), activityData)
    .catch(error => {
        console.error('Failed to add activity:', error);
        process.exit(1);
    });
