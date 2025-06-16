class RunningCharts {
    constructor() {
        this.tooltip = this.createTooltip();
        this.colors = {
            primary: '#fc4c02', // Strava orange
            secondary: '#ff6b35', // Lighter orange
            accent: '#ff9500', // Yellow-orange
            success: '#00d4aa', // Strava teal
            warning: '#ffcc02', // Yellow
            danger: '#e34402', // Dark orange/red
            purple: '#8b5cf6', // Purple
            blue: '#3b82f6', // Blue
            green: '#10b981', // Green
            pink: '#ec4899' // Pink
        };
    }

    createTooltip() {
        return d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);
    }

    createWeeklyDistanceChart(activities, selector) {
        // Clear previous chart
        d3.select(selector).selectAll('*').remove();

        // Group activities by week
        const weeklyData = this.groupActivitiesByWeek(activities);
        
        // Limit to last 12 weeks for better readability
        const recentWeeks = weeklyData.slice(-12);

        const margin = { top: 20, right: 30, bottom: 60, left: 50 }; // Increased bottom margin for rotated labels
        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', 300);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleBand()
            .domain(recentWeeks.map(d => d.week))
            .range([0, width])
            .padding(0.2); // Increased padding for better spacing

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(recentWeeks, d => d.distance)])
            .nice()
            .range([height, 0]);

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)')
            .style('font-size', '10px');

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Bars
        g.selectAll('.bar')
            .data(recentWeeks)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.week))
            .attr('width', xScale.bandwidth())
            .attr('y', d => yScale(d.distance))
            .attr('height', d => height - yScale(d.distance))
            .attr('fill', this.colors.primary)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Week: ${d.week}<br/>Distance: ${d.distance.toFixed(1)} km<br/>Runs: ${d.count}<br/>Avg Pace: ${this.secondsToPace(d.avgPace)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Y-axis label
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Distance (kilometers)');
    }

    createPaceTrendChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        const data = activities
            .filter(d => d.averagePaceMinKm !== '0:00')
            .map(d => ({
                date: new Date(d.date + 'T00:00:00'),
                pace: this.paceToSeconds(d.averagePaceMinKm),
                distance: parseFloat(d.distanceKm)
            }))
            .sort((a, b) => a.date - b.date);

        if (data.length === 0) {
            d3.select(selector).append('div').text('No pace data available');
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', 300);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.pace))
            .nice()
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.pace))
            .curve(d3.curveMonotoneX);

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%m/%d')));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).tickFormat(d => this.secondsToPace(d)));

        // Line
        g.append('path')
            .datum(data)
            .attr('class', 'line')
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', this.colors.primary)
            .attr('stroke-width', 2);

        // Dots
        g.selectAll('.dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.pace))
            .attr('r', 4)
            .attr('fill', this.colors.primary)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Date: ${d.date.toLocaleDateString()}<br/>Pace: ${this.secondsToPace(d.pace)}<br/>Distance: ${d.distance} km`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Y-axis label
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Pace (min/km)');
    }

    createCalendarChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        // Group activities by date
        const dailyData = d3.rollup(
            activities,
            v => ({
                count: v.length,
                distance: d3.sum(v, d => parseFloat(d.distanceKm)),
                avgPace: d3.mean(v, d => this.paceToSeconds(d.averagePaceMinKm))
            }),
            d => d3.timeDay(new Date(d.date + 'T00:00:00'))
        );

        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const cellSize = Math.min(containerWidth / 53, 15); // 53 weeks max
        const height = cellSize * 7 + 40; // 7 days + margin

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', height);

        const now = new Date();
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, d3.max(Array.from(dailyData.values()), d => d.distance)]);

        // Create calendar grid
        const days = d3.timeDays(yearAgo, now);
        
        svg.selectAll('.calendar-cell')
            .data(days)
            .enter().append('rect')
            .attr('class', 'calendar-cell')
            .attr('x', d => d3.timeWeek.count(yearAgo, d) * cellSize)
            .attr('y', d => d.getDay() * cellSize)
            .attr('width', cellSize - 1)
            .attr('height', cellSize - 1)
            .attr('fill', d => {
                const data = dailyData.get(d);
                return data ? colorScale(data.distance) : '#eee';
            })
            .on('mouseover', (event, d) => {
                const data = dailyData.get(d);
                if (data) {
                    this.tooltip.transition().duration(200).style('opacity', .9);
                    this.tooltip.html(`${d.toLocaleDateString()}<br/>Distance: ${data.distance.toFixed(1)} km<br/>Runs: ${data.count}<br/>Avg Pace: ${this.secondsToPace(data.avgPace)}`)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                }
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Month labels
        const months = d3.timeMonths(yearAgo, now);
        svg.selectAll('.month-label')
            .data(months)
            .enter().append('text')
            .attr('class', 'month-label')
            .attr('x', d => d3.timeWeek.count(yearAgo, d) * cellSize)
            .attr('y', -5)
            .style('font-size', '10px')
            .style('fill', '#666')
            .text(d => d3.timeFormat('%b')(d));
    }

    createDistanceDistributionChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        // Create distance bins
        const distances = activities.map(d => parseFloat(d.distanceKm));
        const bins = [0, 5, 8, 11, 16, 24, 32, Infinity];
        const binLabels = ['0-5', '5-8', '8-11', '11-16', '16-24', '24-32', '32+'];
        
        const binData = bins.slice(0, -1).map((bin, i) => {
            const activitiesInBin = activities.filter(act => {
                const dist = parseFloat(act.distanceKm);
                return dist >= bin && dist < bins[i + 1];
            });
            const avgPace = activitiesInBin.length > 0 ? 
                d3.mean(activitiesInBin, d => this.paceToSeconds(d.averagePaceMinKm)) : 0;
            
            return {
                label: binLabels[i],
                count: activitiesInBin.length,
                avgPace: avgPace
            };
        });

        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', 300);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleBand()
            .domain(binData.map(d => d.label))
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(binData, d => d.count)])
            .nice()
            .range([height, 0]);

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Bars
        g.selectAll('.bar')
            .data(binData)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.label))
            .attr('width', xScale.bandwidth())
            .attr('y', d => yScale(d.count))
            .attr('height', d => height - yScale(d.count))
            .attr('fill', this.colors.secondary)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Distance: ${d.label} km<br/>Runs: ${d.count}<br/>Avg Pace: ${this.secondsToPace(d.avgPace)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Distance Range (kilometers)');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Number of Runs');
    }

    createElevationChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        const data = activities
            .filter(d => d.totalElevationGain > 0)
            .map(d => ({
                distance: parseFloat(d.distanceKm),
                elevation: d.totalElevationGain, // Keep in meters
                pace: this.paceToSeconds(d.averagePaceMinKm)
            }));

        if (data.length === 0) {
            d3.select(selector).append('div').text('No elevation data available');
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', 300);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.distance))
            .nice()
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.elevation))
            .nice()
            .range([height, 0]);

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Scatter plot
        g.selectAll('.dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(d.distance))
            .attr('cy', d => yScale(d.elevation))
            .attr('r', 4)
            .attr('fill', this.colors.accent)
            .attr('opacity', 0.7)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Distance: ${d.distance} km<br/>Elevation: ${Math.round(d.elevation)} m<br/>Pace: ${this.secondsToPace(d.pace)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Distance (kilometers)');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Elevation Gain (meters)');
    }

    createHeartRateChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        const data = activities
            .filter(d => d.averageHeartrate)
            .map(d => ({
                date: new Date(d.date + 'T00:00:00'),
                heartRate: d.averageHeartrate,
                distance: parseFloat(d.distanceKm),
                pace: this.paceToSeconds(d.averagePaceMinKm)
            }))
            .sort((a, b) => a.date - b.date);

        if (data.length === 0) {
            d3.select(selector).append('div').text('No heart rate data available');
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', 300);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.heartRate))
            .nice()
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.heartRate))
            .curve(d3.curveMonotoneX);

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%m/%d')));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Line
        g.append('path')
            .datum(data)
            .attr('class', 'line')
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', this.colors.danger)
            .attr('stroke-width', 2);

        // Dots
        g.selectAll('.dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.heartRate))
            .attr('r', 4)
            .attr('fill', this.colors.danger)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Date: ${d.date.toLocaleDateString()}<br/>Heart Rate: ${d.heartRate} bpm<br/>Distance: ${d.distance} km<br/>Pace: ${this.secondsToPace(d.pace)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Y-axis label
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Average Heart Rate (bpm)');
    }

    createMapChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        // Filter activities with valid coordinates
        const activitiesWithCoords = activities.filter(d => 
            d.startLatLng && 
            Array.isArray(d.startLatLng) && 
            d.startLatLng.length === 2 &&
            d.startLatLng[0] !== null && 
            d.startLatLng[1] !== null
        );

        if (activitiesWithCoords.length === 0) {
            d3.select(selector).append('div')
                .style('padding', '20px')
                .style('text-align', 'center')
                .style('color', '#cccccc')
                .text('No GPS data available for mapping');
            return;
        }

        // Create map container
        const mapContainer = d3.select(selector)
            .append('div')
            .attr('id', 'map-' + Date.now())
            .style('height', '400px')
            .style('width', '100%');

        const mapId = mapContainer.attr('id');

        // Initialize Leaflet map
        setTimeout(() => {
            const map = L.map(mapId, {
                zoomControl: true,
                attributionControl: true
            });

            // Add dark tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            // Create bounds for all activities
            const bounds = L.latLngBounds();
            const markers = [];

            // Add markers for each activity
            activitiesWithCoords.forEach((activity, index) => {
                const [lat, lng] = activity.startLatLng;
                const latLng = L.latLng(lat, lng);
                bounds.extend(latLng);

                // Create custom marker with Strava colors
                const marker = L.circleMarker(latLng, {
                    radius: 6,
                    fillColor: this.colors.primary,
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });

                // Create popup content with activity details
                const popupContent = this.createActivityPopup(activity);
                marker.bindPopup(popupContent);

                // Add hover effects
                marker.on('mouseover', function() {
                    this.setStyle({
                        radius: 8,
                        fillColor: '#ff6b35'
                    });
                });

                marker.on('mouseout', function() {
                    this.setStyle({
                        radius: 6,
                        fillColor: '#fc4c02'
                    });
                });

                marker.addTo(map);
                markers.push(marker);

                // Add polyline if available
                if (activity.polyline) {
                    this.addPolylineToMap(map, activity);
                }
            });

            // Fit map to show all markers
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [20, 20] });
            }

            // Add legend
            this.addMapLegend(map, activitiesWithCoords.length);

        }, 100);
    }

    createActivityPopup(activity) {
        const date = new Date(activity.date + 'T00:00:00');
        const location = this.getLocationString(activity);
        
        return `
            <div style="min-width: 200px;">
                <strong style="color: #fc4c02;">${date.toLocaleDateString()}</strong><br/>
                <strong>Distance:</strong> ${activity.distanceKm} km<br/>
                <strong>Pace:</strong> ${activity.averagePaceMinKm}<br/>
                <strong>Time:</strong> ${this.formatTime(activity.movingTime)}<br/>
                <strong>Elevation:</strong> ${Math.round(activity.totalElevationGain)} m<br/>
                ${activity.averageHeartrate ? `<strong>Avg HR:</strong> ${activity.averageHeartrate} bpm<br/>` : ''}
                ${location ? `<strong>Location:</strong> ${location}` : ''}
                ${activity.polyline ? '<div class="polyline-info">📍 Route data available</div>' : ''}
            </div>
        `;
    }

    addPolylineToMap(map, activity) {
        if (!activity.polyline) return;

        try {
            // Decode polyline (assuming it's encoded)
            const coordinates = this.decodePolyline(activity.polyline);
            
            if (coordinates && coordinates.length > 0) {
                const polyline = L.polyline(coordinates, {
                    color: this.colors.accent,
                    weight: 3,
                    opacity: 0.7
                });

                polyline.addTo(map);

                // Add popup to polyline
                polyline.bindPopup(`
                    <div>
                        <strong style="color: #fc4c02;">Route</strong><br/>
                        Distance: ${activity.distanceKm} km<br/>
                        ${coordinates.length} GPS points
                    </div>
                `);
            }
        } catch (error) {
            console.warn('Error adding polyline:', error);
        }
    }

    decodePolyline(encoded) {
        // Simple polyline decoder - this would need to be enhanced for actual Strava polylines
        // For now, return empty array as Strava polylines require special decoding
        return [];
    }

    getLocationString(activity) {
        const parts = [];
        if (activity.city) parts.push(activity.city);
        if (activity.state) parts.push(activity.state);
        if (activity.country) parts.push(activity.country);
        return parts.join(', ');
    }

    addMapLegend(map, activityCount) {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'map-legend');
            div.style.background = 'rgba(45, 45, 45, 0.9)';
            div.style.padding = '8px';
            div.style.color = '#ffffff';
            div.style.fontSize = '12px';
            div.style.border = '1px solid #404040';
            
            div.innerHTML = `
                <strong>Running Activities</strong><br/>
                <span style="color: #fc4c02;">●</span> Start locations (${activityCount})<br/>
                <span style="color: #ff9500;">━</span> Routes (if available)
            `;
            
            return div;
        };
        
        legend.addTo(map);
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}h`;
        } else {
            return `${minutes}m`;
        }
    }

    // Helper methods
    groupActivitiesByWeek(activities) {
        const weekMap = d3.rollup(
            activities,
            v => ({
                distance: d3.sum(v, d => parseFloat(d.distanceKm)),
                count: v.length,
                avgPace: d3.mean(v, d => this.paceToSeconds(d.averagePaceMinKm))
            }),
            d => d3.timeWeek(new Date(d.date + 'T00:00:00'))
        );

        return Array.from(weekMap, ([week, data]) => ({
            week: d3.timeFormat('%m/%d')(week),
            distance: data.distance,
            count: data.count,
            avgPace: data.avgPace
        })).sort((a, b) => new Date(a.week) - new Date(b.week));
    }

    paceToSeconds(paceString) {
        if (!paceString || paceString === '0:00') return 0;
        const [minutes, seconds] = paceString.split(':').map(Number);
        return minutes * 60 + seconds;
    }

    secondsToPace(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}