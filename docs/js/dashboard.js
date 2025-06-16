class RunningDashboard {
    constructor() {
        this.data = null;
        this.charts = new RunningCharts();
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.renderSummaryCards();
            this.renderCharts();
            this.renderActivitiesTable();
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Failed to load running data. Please try again later.');
        }
    }

    async loadData() {
        try {
            const response = await fetch('data/running-data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
            console.log('Data loaded:', this.data);
        } catch (error) {
            console.error('Error loading data:', error);
            // Show sample data if real data fails to load
            this.data = this.getSampleData();
        }
    }

    renderSummaryCards() {
        const summaryContainer = document.getElementById('summaryCards');
        const summary = this.data.summary;
        const yearToDate = this.data.yearToDate || new Date().getFullYear();

        const cards = [
            { value: summary.totalDistance + ' mi', label: `Total Distance (${yearToDate})` },
            { value: this.data.totalActivities, label: 'Total Runs YTD' },
            { value: summary.averagePace || 'N/A', label: 'Average Pace' },
            { value: summary.totalTimeHours + ' hrs', label: 'Total Time' },
            { value: summary.totalElevationGain + ' ft', label: 'Total Elevation' },
            { value: summary.yearToDateStats?.activeDays || summary.activitiesPerWeek || '0', label: this.data.dataRange ? 'Active Days' : 'Runs per Week' }
        ];

        summaryContainer.innerHTML = cards.map(card => `
            <div class="summary-card">
                <div class="value">${card.value}</div>
                <div class="label">${card.label}</div>
            </div>
        `).join('');
    }

    renderCharts() {
        if (!this.data.activities || this.data.activities.length === 0) {
            this.showNoDataMessage();
            return;
        }

        // Create all charts
        this.charts.createWeeklyDistanceChart(this.data.activities, '#weeklyChart');
        this.charts.createPaceTrendChart(this.data.activities, '#paceChart');
        this.charts.createCalendarChart(this.data.activities, '#calendarChart');
        this.charts.createDistanceDistributionChart(this.data.activities, '#distanceChart');
        this.charts.createElevationChart(this.data.activities, '#elevationChart');
        this.charts.createHeartRateChart(this.data.activities, '#heartRateChart');
    }

    renderActivitiesTable() {
        const container = document.getElementById('activitiesTable');
        
        if (!this.data.activities || this.data.activities.length === 0) {
            container.innerHTML = '<p>No activities found.</p>';
            return;
        }

        const recentActivities = this.data.activities.slice(0, 10); // Show last 10 activities

        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Distance</th>
                        <th>Pace</th>
                        <th>Time</th>
                        <th>Elevation</th>
                        <th>Location</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentActivities.map(activity => `
                        <tr>
                            <td>${this.formatDate(activity.date)}</td>
                            <td>${activity.distanceMiles} mi</td>
                            <td>${activity.averagePaceMinMile}</td>
                            <td>${this.formatTime(activity.movingTime)}</td>
                            <td>${Math.round(activity.totalElevationGain * 3.28084)} ft</td>
                            <td>
                                <div class="activity-location">${activity.city || ''} ${activity.state || ''}</div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        if (this.data.lastUpdated) {
            const date = new Date(this.data.lastUpdated);
            const yearInfo = this.data.yearToDate ? ` • ${this.data.yearToDate} Year-to-Date Data` : '';
            const rangeInfo = this.data.dataRange ? ` • ${this.data.dataRange.startDate} to ${this.data.dataRange.endDate}` : '';
            lastUpdatedElement.textContent = `Last updated: ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}${yearInfo}${rangeInfo}`;
        }
    }

    formatDate(dateString) {
        // Handle both full datetime strings and date-only strings
        const date = new Date(dateString + (dateString.includes('T') ? '' : 'T00:00:00'));
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    showError(message) {
        document.querySelector('.container').innerHTML = `
            <div class="error">
                <h2>Error</h2>
                <p>${message}</p>
            </div>
        `;
    }

    showNoDataMessage() {
        const chartContainers = document.querySelectorAll('.chart');
        chartContainers.forEach(container => {
            container.innerHTML = '<div class="loading">No data available</div>';
        });
    }

    getSampleData() {
        // Sample data for development/testing
        return {
            lastUpdated: new Date().toISOString(),
            totalActivities: 5,
            activities: [
                {
                    id: 1,
                    date: "2025-06-15",
                    distanceMiles: "3.1",
                    averagePaceMinMile: "8:30",
                    movingTime: 1584,
                    totalElevationGain: 50,
                    city: "San Francisco",
                    state: "CA",
                    averageHeartrate: 150
                },
                {
                    id: 2,
                    date: "2025-06-13",
                    distanceMiles: "5.0",
                    averagePaceMinMile: "9:15",
                    movingTime: 2775,
                    totalElevationGain: 120,
                    city: "San Francisco",
                    state: "CA",
                    averageHeartrate: 145
                },
                {
                    id: 3,
                    date: "2025-06-11",
                    distanceMiles: "10.0",
                    averagePaceMinMile: "9:45",
                    movingTime: 5850,
                    totalElevationGain: 300,
                    city: "San Francisco",
                    state: "CA",
                    averageHeartrate: 155
                },
                {
                    id: 4,
                    date: "2025-06-09",
                    distanceMiles: "6.2",
                    averagePaceMinMile: "10:30",
                    movingTime: 3906,
                    totalElevationGain: 500,
                    city: "Mill Valley",
                    state: "CA",
                    averageHeartrate: 160
                },
                {
                    id: 5,
                    date: "2025-06-07",
                    distanceMiles: "2.5",
                    averagePaceMinMile: "10:00",
                    movingTime: 1500,
                    totalElevationGain: 25,
                    city: "San Francisco",
                    state: "CA",
                    averageHeartrate: 140
                }
            ],
            summary: {
                totalDistance: "26.8",
                totalTimeHours: "4.2",
                totalElevationGain: "995",
                averageDistance: "5.36",
                averagePace: "9:24",
                activitiesPerWeek: "3.5"
            }
        };
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RunningDashboard();
});