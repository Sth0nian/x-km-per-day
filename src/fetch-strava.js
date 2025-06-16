const fs = require('fs').promises;
const path = require('path');

class StravaDataFetcher {
    constructor() {
        this.clientId = process.env.STRAVA_CLIENT_ID;
        this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
        this.refreshToken = process.env.STRAVA_REFRESH_TOKEN;
        this.baseUrl = 'https://www.strava.com/api/v3';
        this.accessToken = null;
    }

    async refreshAccessToken() {
        console.log('Refreshing Strava access token...');
        
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to refresh token: ${response.statusText}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        console.log('Access token refreshed successfully');
        
        return data;
    }

    async fetchActivitiesSinceDate(sinceDate) {
        if (!this.accessToken) {
            await this.refreshAccessToken();
        }

        console.log(`Fetching all activities since ${sinceDate.toISOString().split('T')[0]}...`);
        
        const allActivities = [];
        const perPage = 200; // Maximum allowed by Strava API
        let page = 1;
        let hasMoreActivities = true;
        
        // Convert date to Unix timestamp (Strava API requirement)
        const afterTimestamp = Math.floor(sinceDate.getTime() / 1000);

        while (hasMoreActivities) {
            console.log(`Fetching page ${page}...`);
            
            const response = await fetch(
                `${this.baseUrl}/athlete/activities?per_page=${perPage}&page=${page}&after=${afterTimestamp}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch activities: ${response.statusText}`);
            }

            const activities = await response.json();
            
            if (activities.length === 0) {
                hasMoreActivities = false;
                console.log('No more activities found');
            } else {
                allActivities.push(...activities);
                console.log(`Fetched ${activities.length} activities (total: ${allActivities.length})`);
                
                // If we got fewer than perPage activities, we've reached the end
                if (activities.length < perPage) {
                    hasMoreActivities = false;
                    console.log('Reached end of activities');
                } else {
                    page++;
                    // Add a small delay to be respectful to Strava's API
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        console.log(`Total activities fetched: ${allActivities.length}`);
        return allActivities;
    }

    async fetchDetailedActivity(activityId) {
        if (!this.accessToken) {
            await this.refreshAccessToken();
        }

        const response = await fetch(
            `${this.baseUrl}/activities/${activityId}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );

        if (!response.ok) {
            console.warn(`Failed to fetch detailed activity ${activityId}: ${response.statusText}`);
            return null;
        }

        return await response.json();
    }

    filterRunningActivities(activities) {
        return activities.filter(activity => 
            activity.type === 'Run' || 
            activity.sport_type === 'Run'
        );
    }

    async processActivities() {
        try {
            // Fetch all activities since January 1st of current year
            const allActivities = await this.fetchActivitiesSinceDate(new Date(new Date().getFullYear(), 0, 1));
            const runningActivities = this.filterRunningActivities(allActivities);
            
            console.log(`Found ${runningActivities.length} running activities since January 1st`);

            // Process each activity to extract relevant data (excluding names and specific times)
            const processedActivities = runningActivities.map(activity => ({
                id: activity.id,
                date: activity.start_date.split('T')[0], // Date only, no time
                distance: activity.distance, // meters
                distanceMiles: (activity.distance * 0.000621371).toFixed(2), // convert to miles
                distanceKm: (activity.distance / 1000).toFixed(2), // convert to km
                movingTime: activity.moving_time, // seconds
                elapsedTime: activity.elapsed_time, // seconds
                totalElevationGain: activity.total_elevation_gain, // meters
                averageSpeed: activity.average_speed, // m/s
                maxSpeed: activity.max_speed, // m/s
                averagePaceMinMile: this.convertSpeedToPace(activity.average_speed, 'mile'),
                averagePaceMinKm: this.convertSpeedToPace(activity.average_speed, 'km'),
                averageHeartrate: activity.average_heartrate,
                maxHeartrate: activity.max_heartrate,
                sufferScore: activity.suffer_score,
                kudosCount: activity.kudos_count,
                startLatLng: activity.start_latlng,
                endLatLng: activity.end_latlng,
                city: activity.location_city,
                state: activity.location_state,
                country: activity.location_country,
                weatherTemp: activity.average_temp,
                gear: activity.gear_id
            }));

            // Sort by date (newest first)
            processedActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Ensure data directory exists
            const dataDir = path.join(__dirname, '..', 'docs', 'data');
            await fs.mkdir(dataDir, { recursive: true });

            // Generate enhanced summary with year-to-date data
            const outputData = {
                lastUpdated: new Date().toISOString(),
                totalActivities: processedActivities.length,
                yearToDate: new Date().getFullYear(),
                dataRange: {
                    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                    totalDays: Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24))
                },
                activities: processedActivities,
                summary: this.generateSummary(processedActivities)
            };

            // Save processed data
            const outputPath = path.join(dataDir, 'running-data.json');

            await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
            console.log(`Data saved to ${outputPath}`);
            console.log(`Year-to-date summary: ${processedActivities.length} activities processed`);
            console.log(`Date range: ${outputData.dataRange.startDate} to ${outputData.dataRange.endDate}`);

        } catch (error) {
            console.error('Error processing activities:', error);
            process.exit(1);
        }
    }

    convertSpeedToPace(speedMs, unit = 'mile') {
        if (!speedMs || speedMs === 0) return '0:00';
        
        const multiplier = unit === 'mile' ? 1609.34 : 1000; // meters per mile or km
        const paceSeconds = multiplier / speedMs;
        const minutes = Math.floor(paceSeconds / 60);
        const seconds = Math.floor(paceSeconds % 60);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    generateSummary(activities) {
        if (activities.length === 0) return {};

        const totalDistance = activities.reduce((sum, act) => sum + parseFloat(act.distanceMiles), 0);
        const totalTime = activities.reduce((sum, act) => sum + act.movingTime, 0);
        const totalElevation = activities.reduce((sum, act) => sum + (act.totalElevationGain || 0), 0);
        
        const avgDistance = totalDistance / activities.length;
        const avgPace = this.convertSpeedToPace(
            activities.reduce((sum, act) => sum + act.averageSpeed, 0) / activities.length
        );

        // Get date range
        const dates = activities.map(act => new Date(act.date)).sort((a, b) => a - b);
        const dateRange = {
            start: dates[0]?.toISOString().split('T')[0],
            end: dates[dates.length - 1]?.toISOString().split('T')[0]
        };

        return {
            totalDistance: totalDistance.toFixed(2),
            totalTimeHours: (totalTime / 3600).toFixed(1),
            totalElevationGain: totalElevation.toFixed(0),
            averageDistance: avgDistance.toFixed(2),
            averagePace: avgPace,
            dateRange,
            activitiesPerWeek: (activities.length / this.getWeeksBetweenDates(dates[0], dates[dates.length - 1])).toFixed(1),
            yearToDateStats: {
                totalDays: Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24)),
                activeDays: new Set(activities.map(act => act.date.split('T')[0])).size,
                averageDistancePerRun: avgDistance.toFixed(2),
                totalRuns: activities.length,
                longestRun: activities.length > 0 ? Math.max(...activities.map(act => parseFloat(act.distanceMiles))).toFixed(2) : '0'
            }
        };
    }

    getWeeksBetweenDates(date1, date2) {
        const diffTime = Math.abs(date2 - date1);
        const diffWeeks = diffTime / (1000 * 60 * 60 * 24 * 7);
        return Math.max(diffWeeks, 1); // At least 1 week
    }
}

// Run the fetcher
if (require.main === module) {
    const fetcher = new StravaDataFetcher();
    fetcher.processActivities();
}

module.exports = StravaDataFetcher;