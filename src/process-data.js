const fs = require('fs').promises;
const path = require('path');

class DataProcessor {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'docs', 'data', 'running-data.json');
    }

    async processData() {
        try {
            console.log('Processing running data...');
            
            // Read existing data
            const rawData = await fs.readFile(this.dataPath, 'utf8');
            const data = JSON.parse(rawData);
            
            if (!data.activities || data.activities.length === 0) {
                console.log('No activities to process');
                return;
            }

            // Add additional computed fields
            const processedActivities = data.activities.map(activity => ({
                ...activity,
                // Add computed fields
                pacePerMile: this.calculatePacePerMile(activity.movingTime, parseFloat(activity.distanceMiles)),
                elevationPerMile: this.calculateElevationPerMile(activity.totalElevationGain, parseFloat(activity.distanceMiles)),
                speedMph: this.calculateSpeedMph(parseFloat(activity.distanceMiles), activity.movingTime),
                weekday: new Date(activity.date).toLocaleDateString('en-US', { weekday: 'long' }),
                month: new Date(activity.date).toLocaleDateString('en-US', { month: 'long' }),
                year: new Date(activity.date).getFullYear(),
                quarterYear: this.getQuarter(new Date(activity.date)),
                isWeekend: this.isWeekend(new Date(activity.date)),
                timeOfDay: this.getTimeOfDay(new Date(activity.date)),
                season: this.getSeason(new Date(activity.date))
            }));

            // Generate enhanced analytics
            const analytics = this.generateAnalytics(processedActivities);
            
            // Create final processed data
            const processedData = {
                ...data,
                activities: processedActivities,
                analytics: analytics,
                processedAt: new Date().toISOString()
            };

            // Write processed data back
            await fs.writeFile(this.dataPath, JSON.stringify(processedData, null, 2));
            
            console.log('Data processing completed successfully');
            console.log(`Processed ${processedActivities.length} activities`);
            console.log('Analytics generated:', Object.keys(analytics));

        } catch (error) {
            console.error('Error processing data:', error);
            process.exit(1);
        }
    }

    calculatePacePerMile(timeSeconds, distanceMiles) {
        if (!distanceMiles || distanceMiles === 0) return 0;
        return timeSeconds / distanceMiles;
    }

    calculateElevationPerMile(elevationMeters, distanceMiles) {
        if (!distanceMiles || distanceMiles === 0) return 0;
        return (elevationMeters * 3.28084) / distanceMiles; // Convert to feet per mile
    }

    calculateSpeedMph(distanceMiles, timeSeconds) {
        if (!timeSeconds || timeSeconds === 0) return 0;
        return (distanceMiles * 3600) / timeSeconds; // miles per hour
    }

    getQuarter(date) {
        const month = date.getMonth();
        return Math.floor(month / 3) + 1;
    }

    isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }

    getTimeOfDay(date) {
        const hour = date.getHours();
        if (hour < 6) return 'Early Morning';
        if (hour < 12) return 'Morning';
        if (hour < 17) return 'Afternoon';
        if (hour < 20) return 'Evening';
        return 'Night';
    }

    getSeason(date) {
        const month = date.getMonth();
        if (month >= 2 && month <= 4) return 'Spring';
        if (month >= 5 && month <= 7) return 'Summer';
        if (month >= 8 && month <= 10) return 'Fall';
        return 'Winter';
    }

    generateAnalytics(activities) {
        const analytics = {};

        // Basic statistics
        analytics.totalStats = this.calculateTotalStats(activities);
        
        // Trends and patterns
        analytics.trends = this.calculateTrends(activities);
        
        // Performance insights
        analytics.performance = this.calculatePerformanceMetrics(activities);
        
        // Time-based analysis
        analytics.temporal = this.calculateTemporalAnalysis(activities);
        
        // Weekly/Monthly summaries
        analytics.summaries = this.calculateSummaries(activities);

        return analytics;
    }

    calculateTotalStats(activities) {
        if (activities.length === 0) return {};

        const totalDistance = activities.reduce((sum, a) => sum + parseFloat(a.distanceMiles), 0);
        const totalTime = activities.reduce((sum, a) => sum + a.movingTime, 0);
        const totalElevation = activities.reduce((sum, a) => sum + (a.totalElevationGain * 3.28084), 0);

        return {
            totalRuns: activities.length,
            totalDistance: totalDistance.toFixed(2),
            totalTimeHours: (totalTime / 3600).toFixed(1),
            totalElevationFeet: totalElevation.toFixed(0),
            averageDistance: (totalDistance / activities.length).toFixed(2),
            averageTimeMinutes: (totalTime / activities.length / 60).toFixed(0),
            longestRun: Math.max(...activities.map(a => parseFloat(a.distanceMiles))).toFixed(2),
            shortestRun: Math.min(...activities.map(a => parseFloat(a.distanceMiles))).toFixed(2)
        };
    }

    calculateTrends(activities) {
        if (activities.length < 2) return {};

        // Sort by date
        const sortedActivities = [...activities].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate rolling averages
        const rollingWindow = Math.min(5, sortedActivities.length);
        const recentActivities = sortedActivities.slice(-rollingWindow);
        const earlierActivities = sortedActivities.slice(0, rollingWindow);

        const recentAvgDistance = recentActivities.reduce((sum, a) => sum + parseFloat(a.distanceMiles), 0) / recentActivities.length;
        const earlierAvgDistance = earlierActivities.reduce((sum, a) => sum + parseFloat(a.distanceMiles), 0) / earlierActivities.length;

        const recentAvgPace = recentActivities.reduce((sum, a) => sum + this.paceToSeconds(a.averagePaceMinMile), 0) / recentActivities.length;
        const earlierAvgPace = earlierActivities.reduce((sum, a) => sum + this.paceToSeconds(a.averagePaceMinMile), 0) / earlierActivities.length;

        return {
            distanceTrend: recentAvgDistance > earlierAvgDistance ? 'improving' : 'declining',
            paceTrend: recentAvgPace < earlierAvgPace ? 'improving' : 'declining',
            recentAvgDistance: recentAvgDistance.toFixed(2),
            recentAvgPace: this.secondsToPace(recentAvgPace),
            consistency: this.calculateConsistency(sortedActivities)
        };
    }

    calculatePerformanceMetrics(activities) {
        const paces = activities
            .filter(a => a.averagePaceMinMile && a.averagePaceMinMile !== '0:00')
            .map(a => this.paceToSeconds(a.averagePaceMinMile));

        const distances = activities.map(a => parseFloat(a.distanceMiles));

        return {
            bestPace: paces.length > 0 ? this.secondsToPace(Math.min(...paces)) : 'N/A',
            worstPace: paces.length > 0 ? this.secondsToPace(Math.max(...paces)) : 'N/A',
            paceVariability: paces.length > 0 ? this.calculateStandardDeviation(paces).toFixed(0) + ' sec' : 'N/A',
            distanceVariability: this.calculateStandardDeviation(distances).toFixed(2) + ' mi',
            personalRecords: this.findPersonalRecords(activities)
        };
    }

    calculateTemporalAnalysis(activities) {
        // Group by day of week
        const dayGroups = this.groupBy(activities, a => a.weekday);
        const favoriteDay = Object.entries(dayGroups)
            .sort(([,a], [,b]) => b.length - a.length)[0]?.[0] || 'N/A';

        // Group by time of day
        const timeGroups = this.groupBy(activities, a => a.timeOfDay);
        const favoriteTime = Object.entries(timeGroups)
            .sort(([,a], [,b]) => b.length - a.length)[0]?.[0] || 'N/A';

        // Seasonal analysis
        const seasonGroups = this.groupBy(activities, a => a.season);

        return {
            favoriteDay,
            favoriteTime,
            weekendVsWeekday: {
                weekend: activities.filter(a => a.isWeekend).length,
                weekday: activities.filter(a => !a.isWeekend).length
            },
            seasonalBreakdown: Object.fromEntries(
                Object.entries(seasonGroups).map(([season, acts]) => [
                    season, 
                    {
                        count: acts.length,
                        avgDistance: (acts.reduce((sum, a) => sum + parseFloat(a.distanceMiles), 0) / acts.length).toFixed(2)
                    }
                ])
            )
        };
    }

    calculateSummaries(activities) {
        // Monthly summaries
        const monthlyGroups = this.groupBy(activities, a => `${a.year}-${a.month}`);
        const monthlySummary = Object.fromEntries(
            Object.entries(monthlyGroups).map(([month, acts]) => [
                month,
                {
                    runs: acts.length,
                    distance: acts.reduce((sum, a) => sum + parseFloat(a.distanceMiles), 0).toFixed(2),
                    time: (acts.reduce((sum, a) => sum + a.movingTime, 0) / 3600).toFixed(1)
                }
            ])
        );

        // Weekly summaries (last 12 weeks)
        const weeklySummary = this.calculateWeeklySummary(activities);

        return {
            monthly: monthlySummary,
            weekly: weeklySummary
        };
    }

    calculateWeeklySummary(activities) {
        const weeks = {};
        
        activities.forEach(activity => {
            const date = new Date(activity.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeks[weekKey]) {
                weeks[weekKey] = {
                    runs: 0,
                    distance: 0,
                    time: 0
                };
            }
            
            weeks[weekKey].runs++;
            weeks[weekKey].distance += parseFloat(activity.distanceMiles);
            weeks[weekKey].time += activity.movingTime;
        });

        // Format and sort weeks
        return Object.entries(weeks)
            .sort(([a], [b]) => new Date(b) - new Date(a))
            .slice(0, 12) // Last 12 weeks
            .map(([week, data]) => ({
                week,
                runs: data.runs,
                distance: data.distance.toFixed(2),
                time: (data.time / 3600).toFixed(1)
            }));
    }

    calculateConsistency(activities) {
        if (activities.length < 7) return 'N/A';
        
        // Calculate gaps between runs
        const gaps = [];
        for (let i = 1; i < activities.length; i++) {
            const gap = (new Date(activities[i].date) - new Date(activities[i-1].date)) / (1000 * 60 * 60 * 24);
            gaps.push(gap);
        }
        
        const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
        
        if (avgGap <= 2) return 'Very High';
        if (avgGap <= 4) return 'High';
        if (avgGap <= 7) return 'Moderate';
        return 'Low';
    }

    findPersonalRecords(activities) {
        const records = {};
        
        // Distance records
        const sortedByDistance = [...activities].sort((a, b) => parseFloat(b.distanceMiles) - parseFloat(a.distanceMiles));
        records.longestRun = sortedByDistance[0] ? {
            distance: sortedByDistance[0].distanceMiles,
            date: sortedByDistance[0].date,
            name: sortedByDistance[0].name
        } : null;

        // Pace records (fastest)
        const validPaceActivities = activities.filter(a => a.averagePaceMinMile && a.averagePaceMinMile !== '0:00');
        if (validPaceActivities.length > 0) {
            const fastestRun = validPaceActivities.reduce((fastest, current) => {
                const currentPace = this.paceToSeconds(current.averagePaceMinMile);
                const fastestPace = this.paceToSeconds(fastest.averagePaceMinMile);
                return currentPace < fastestPace ? current : fastest;
            });
            
            records.fastestPace = {
                pace: fastestRun.averagePaceMinMile,
                distance: fastestRun.distanceMiles,
                date: fastestRun.date,
                name: fastestRun.name
            };
        }

        return records;
    }

    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    }

    groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
        }, {});
    }

    paceToSeconds(paceString) {
        if (!paceString || paceString === '0:00') return 0;
        const [minutes, seconds] = paceString.split(':').map(Number);
        return minutes * 60 + seconds;
    }

    secondsToPace(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Run the processor
if (require.main === module) {
    const processor = new DataProcessor();
    processor.processData();
}

module.exports = DataProcessor;