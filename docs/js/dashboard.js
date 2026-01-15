class RunningDashboard {
    constructor() {
        this.data = null;
        this.currentYear = new Date().getFullYear();

        // Check if RunningCharts is available
        if (typeof RunningCharts === 'undefined') {
            console.error('RunningCharts class not found. Make sure charts.js is loaded before dashboard.js');
            this.charts = null;
        } else {
            this.charts = new RunningCharts();
        }

        this.init();
    }

    async init() {
        try {
            await this.loadData(this.currentYear);
            this.initializeYearSelector();
            this.renderSummaryCards();
            this.renderCharts();
            this.renderActivitiesTable();
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Failed to load running data. Please try again later.');
        }
    }

    async loadData(year) {
        try {
            const dataFile = `data/running-data-${year}.json`;
            const response = await fetch(dataFile);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
            this.currentYear = year;
            console.log(`Data loaded for year ${year}:`, this.data);

            // Load gear mapping
            await this.loadGearMapping();
        } catch (error) {
            console.error(`Error loading data for year ${year}:`, error);
            // Show sample data if real data fails to load
            this.data = this.getSampleData();
        }
    }

    async loadGearMapping() {
        try {
            console.log('Loading gear mapping...');
            const response = await fetch('data/gear-mapping.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const gearData = await response.json();
            window.gearMapping = gearData.gearMapping;
            window.gearOverrides = gearData.overrides || {};
            console.log('Gear mapping loaded:', window.gearMapping);
            console.log('Gear overrides loaded:', window.gearOverrides);
        } catch (error) {
            console.error('Error loading gear mapping:', error);
            window.gearMapping = {};
            window.gearOverrides = {};
        }
    }

    renderSummaryCards() {
        const summaryContainer = document.getElementById('summaryCards');
        const summary = this.data.summary;
        const yearToDate = this.data.yearToDate || new Date().getFullYear();

        const cards = [
            { value: summary.totalDistance + ' km', label: `Total Distance (${yearToDate})` },
            { value: this.data.totalActivities, label: 'Total Runs YTD' },
            { value: summary.averagePace || 'N/A', label: 'Average Pace (min/km)' },
            { value: summary.totalTimeHours + ' hrs', label: 'Total Time' },
            { value: summary.totalElevationGain + ' m', label: 'Total Elevation' },
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
        if (!this.charts) {
            console.error('Charts not available - RunningCharts class not loaded');
            this.showNoDataMessage();
            return;
        }

        if (!this.data.activities || this.data.activities.length === 0) {
            this.showNoDataMessage();
            return;
        }

        // Create all charts - check if elements exist first
        try {
            const chartElements = [
                { selector: '#weeklyChart', method: 'createWeeklyDistanceChart' },
                { selector: '#paceChart', method: 'createPaceTrendChart' },
                { selector: '#calendarChart', method: 'createCalendarChart' },
                { selector: '#distanceChart', method: 'createDistanceDistributionChart' },
                { selector: '#elevationChart', method: 'createElevationChart' },
                { selector: '#heartRateChart', method: 'createHeartRateChart' },
                { selector: '#mapChart', method: 'createMapChart' },
                { selector: '#prChart', method: 'createPersonalRecordsChart' },
                { selector: '#trainingLoadChart', method: 'createTrainingLoadChart' },
                { selector: '#gearChart', method: 'createGearChart' }
            ];

            chartElements.forEach(({ selector, method }) => {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`Creating chart: ${method} for ${selector}`);
                    try {
                        this.charts[method](this.data.activities, selector);
                    } catch (error) {
                        console.error(`Error creating chart ${method}:`, error);
                    }
                } else {
                    console.warn(`Element ${selector} not found, skipping chart`);
                }
            });
        } catch (error) {
            console.error('Error creating charts:', error);
            this.showError('Error creating charts. Please refresh the page.');
        }
    }

    renderActivitiesTable() {
        const container = document.getElementById('activitiesTable');
        
        if (!container) {
            console.warn('Activities table container not found');
            return;
        }
        
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
                            <td>${activity.distanceKm} km</td>
                            <td>${activity.averagePaceMinKm}</td>
                            <td>${this.formatTime(activity.movingTime)}</td>
                            <td>${Math.round(activity.totalElevationGain)} m</td>
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

    async initializeYearSelector() {
        const yearSelector = document.getElementById('yearSelector');
        if (!yearSelector) return;

        const availableYears = await this.getAvailableYears();
        yearSelector.innerHTML = availableYears.map(year => `
            <option value="${year}" ${year === this.currentYear ? 'selected' : ''}>${year}</option>
        `).join('');

        yearSelector.addEventListener('change', async (e) => {
            const selectedYear = parseInt(e.target.value);
            await this.loadData(selectedYear);
            this.renderSummaryCards();
            this.renderCharts();
            this.renderActivitiesTable();
            this.updateLastUpdated();
        });
    }

    async getAvailableYears() {
        const years = [];
        const currentYear = new Date().getFullYear();

        // Check files from previous years up to current year
        for (let year = 2025; year <= currentYear; year++) {
            try {
                const response = await fetch(`data/running-data-${year}.json`, { method: 'HEAD' });
                if (response.ok) {
                    years.push(year);
                }
            } catch (error) {
                console.log(`running-data-${year}.json not found`);
            }
        }

        return years.sort((a, b) => b - a); // Return in descending order
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
                    distanceKm: "5.0",
                    averagePaceMinKm: "5:16",
                    movingTime: 1584,
                    totalElevationGain: 50,
                    city: "San Francisco",
                    state: "CA",
                    country: "United States",
                    averageHeartrate: 150,
                    startLatLng: [37.7749, -122.4194]
                },
                {
                    id: 2,
                    date: "2025-06-13",
                    distanceKm: "8.0",
                    averagePaceMinKm: "5:45",
                    movingTime: 2775,
                    totalElevationGain: 120,
                    city: "San Francisco",
                    state: "CA",
                    country: "United States",
                    averageHeartrate: 145,
                    startLatLng: [37.7849, -122.4094]
                },
                {
                    id: 3,
                    date: "2025-06-11",
                    distanceKm: "16.1",
                    averagePaceMinKm: "6:04",
                    movingTime: 5850,
                    totalElevationGain: 300,
                    city: "San Francisco",
                    state: "CA",
                    country: "United States",
                    averageHeartrate: 155,
                    startLatLng: [37.7649, -122.4394]
                },
                {
                    id: 4,
                    date: "2025-06-09",
                    distanceKm: "10.0",
                    averagePaceMinKm: "6:32",
                    movingTime: 3906,
                    totalElevationGain: 500,
                    city: "Mill Valley",
                    state: "CA",
                    country: "United States",
                    averageHeartrate: 160,
                    startLatLng: [37.9060, -122.5450]
                },
                {
                    id: 5,
                    date: "2025-06-07",
                    distanceKm: "4.0",
                    averagePaceMinKm: "6:12",
                    movingTime: 1500,
                    totalElevationGain: 25,
                    city: "San Francisco",
                    state: "CA",
                    country: "United States",
                    averageHeartrate: 140,
                    startLatLng: [37.7549, -122.4094]
                }
            ],
            summary: {
                totalDistance: "43.1",
                totalTimeHours: "4.2",
                totalElevationGain: "995",
                averageDistance: "8.62",
                averagePace: "5:51",
                activitiesPerWeek: "3.5"
            }
        };
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
        console.error('D3.js not loaded. Please check the script tag.');
        document.querySelector('.container').innerHTML = `
            <div class="error">
                <h2>Missing Dependencies</h2>
                <p>D3.js library failed to load. Please check your internet connection and refresh the page.</p>
            </div>
        `;
        return;
    }

    // Check if RunningCharts is available
    if (typeof RunningCharts === 'undefined') {
        console.error('RunningCharts not loaded. Please check that charts.js loads before dashboard.js');
        document.querySelector('.container').innerHTML = `
            <div class="error">
                <h2>Script Loading Error</h2>
                <p>Chart library failed to load. Please refresh the page.</p>
            </div>
        `;
        return;
    }

    // Initialize dashboard
    new RunningDashboard();
});