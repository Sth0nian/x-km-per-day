// Simple version of charts.js for debugging
console.log('Charts.js loading...');

class RunningCharts {
    constructor() {
        console.log('RunningCharts initialized');
        this.colors = {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb'
        };
    }

    createWeeklyDistanceChart(activities, selector) {
        console.log('Creating weekly distance chart with', activities.length, 'activities');
        const container = d3.select(selector);
        container.html('<div style="padding: 20px; text-align: center;">Weekly Distance Chart<br><small>Chart implementation loading...</small></div>');
    }

    createPaceTrendChart(activities, selector) {
        console.log('Creating pace trend chart');
        const container = d3.select(selector);
        container.html('<div style="padding: 20px; text-align: center;">Pace Trend Chart<br><small>Chart implementation loading...</small></div>');
    }

    createCalendarChart(activities, selector) {
        console.log('Creating calendar chart');
        const container = d3.select(selector);
        container.html('<div style="padding: 20px; text-align: center;">Calendar Chart<br><small>Chart implementation loading...</small></div>');
    }

    createDistanceDistributionChart(activities, selector) {
        console.log('Creating distance distribution chart');
        const container = d3.select(selector);
        container.html('<div style="padding: 20px; text-align: center;">Distance Distribution Chart<br><small>Chart implementation loading...</small></div>');
    }

    createElevationChart(activities, selector) {
        console.log('Creating elevation chart');
        const container = d3.select(selector);
        container.html('<div style="padding: 20px; text-align: center;">Elevation Chart<br><small>Chart implementation loading...</small></div>');
    }

    createHeartRateChart(activities, selector) {
        console.log('Creating heart rate chart');
        const container = d3.select(selector);
        container.html('<div style="padding: 20px; text-align: center;">Heart Rate Chart<br><small>Chart implementation loading...</small></div>');
    }
}

console.log('RunningCharts class defined');