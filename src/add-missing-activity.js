const fs = require('fs').promises;
const path = require('path');

class ActivityAdder {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'docs', 'data');
        this.clientId = process.env.STRAVA_CLIENT_ID;
        this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
        this.refreshToken = process.env.STRAVA_REFRESH_TOKEN;
        this.baseUrl = 'https://www.strava.com/api/v3';
        this.accessToken = null;
    }

    async refreshAccessToken() {
        if (!this.clientId || !this.clientSecret || !this.refreshToken) {
            console.log('ℹ️  Strava credentials not available. Will use manual input.');
            return false;
        }

        try {
            console.log('🔄 Refreshing Strava access token...');
            const response = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                console.log('⚠️  Failed to refresh Strava token');
                return false;
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            console.log('✓ Strava access token refreshed');
            return true;
        } catch (error) {
            console.log('⚠️  Error refreshing Strava token:', error.message);
            return false;
        }
    }

    async fetchActivityFromStrava(date) {
        if (!this.accessToken) {
            console.log('ℹ️  No Strava token available');
            return null;
        }

        try {
            console.log(`🔍 Searching Strava for activities on ${date}...`);

            // Create date range (midnight to midnight)
            const startDate = new Date(date + 'T00:00:00Z');
            const endDate = new Date(date + 'T23:59:59Z');
            const startTimestamp = Math.floor(startDate.getTime() / 1000);
            const endTimestamp = Math.floor(endDate.getTime() / 1000);

            const response = await fetch(
                `${this.baseUrl}/athlete/activities?before=${endTimestamp}&after=${startTimestamp}&per_page=30`,
                {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                }
            );

            if (!response.ok) {
                console.log(`⚠️  Strava API error: ${response.status}`);
                return null;
            }

            const activities = await response.json();

            // Filter for running activities
            const runningActivities = activities.filter(a => a.sport_type === 'Run');

            if (runningActivities.length === 0) {
                console.log(`ℹ️  No running activities found on ${date}`);
                return null;
            }

            if (runningActivities.length > 1) {
                console.log(`⚠️  Multiple running activities found on ${date}, using first one`);
            }

            const activity = runningActivities[0];
            console.log(`✓ Found activity: ${activity.name}`);
            return activity;
        } catch (error) {
            console.log('⚠️  Error fetching from Strava:', error.message);
            return null;
        }
    }

    processStravaActivity(stravaActivity) {
        const distanceKm = stravaActivity.distance / 1000;
        const movingTime = stravaActivity.moving_time;

        return {
            date: stravaActivity.start_date.split('T')[0],
            distanceKm: distanceKm.toFixed(2),
            distanceMiles: (distanceKm * 0.621371).toFixed(2),
            movingTime: movingTime,
            elapsedTime: stravaActivity.elapsed_time,
            totalElevationGain: stravaActivity.total_elevation_gain || 0,
            averageSpeed: stravaActivity.average_speed,
            maxSpeed: stravaActivity.max_speed,
            averageHeartrate: stravaActivity.average_heartrate || 0,
            maxHeartrate: stravaActivity.max_heartrate || 0,
            sufferScore: stravaActivity.suffer_score || 0,
            kudosCount: stravaActivity.kudos_count || 0,
            startLatLng: stravaActivity.start_latlng || [],
            endLatLng: stravaActivity.end_latlng || [],
            city: stravaActivity.location_city || null,
            state: stravaActivity.location_state || null,
            country: stravaActivity.location_country || null,
            gear: stravaActivity.gear_id || null
        };
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
const date = process.env.ACTIVITY_DATE;

if (!year || !date) {
    console.error('Missing required environment variables: ACTIVITY_YEAR, ACTIVITY_DATE');
    process.exit(1);
}

const adder = new ActivityAdder();

(async () => {
    try {
        let activityData = null;

        // Try to fetch from Strava first
        const hasToken = await adder.refreshAccessToken();
        if (hasToken) {
            const stravaActivity = await adder.fetchActivityFromStrava(date);
            if (stravaActivity) {
                activityData = adder.processStravaActivity(stravaActivity);
                console.log(`\n✓ Using data from Strava:`);
                console.log(`  Distance: ${activityData.distanceKm} km`);
                console.log(`  Time: ${activityData.movingTime} seconds`);
                console.log(`  HR: ${activityData.averageHeartrate} bpm`);
            }
        }

        // Fall back to manual input if Strava fetch failed
        if (!activityData) {
            console.log('\n📝 Using manual input values');
            if (!process.env.ACTIVITY_DISTANCE || !process.env.ACTIVITY_TIME) {
                console.error('Error: Strava fetch failed and manual input incomplete');
                console.error('Required: ACTIVITY_DISTANCE, ACTIVITY_TIME');
                process.exit(1);
            }

            activityData = {
                date: date,
                distanceKm: process.env.ACTIVITY_DISTANCE,
                movingTime: process.env.ACTIVITY_TIME,
                totalElevationGain: process.env.ACTIVITY_ELEVATION || 0,
                averageHeartrate: process.env.ACTIVITY_HR || 0,
                maxHeartrate: process.env.ACTIVITY_MAX_HR || 0
            };
        }

        // Add the activity to the year file
        await adder.addActivity(parseInt(year), activityData);
    } catch (error) {
        console.error('Failed to add activity:', error);
        process.exit(1);
    }
})();
