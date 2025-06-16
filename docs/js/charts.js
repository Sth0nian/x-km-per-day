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

        // Create rolling average data for smoother trend line
        const rollingAverage = this.calculateRollingAverage(data, 5); // 5-day rolling average

        // Line generators
        const trendLine = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.avgPace))
            .curve(d3.curveBasis); // Smooth curve

        const dataLine = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.pace))
            .curve(d3.curveLinear);

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%m/%d')));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).tickFormat(d => this.secondsToPace(d)));

        // Background data points (faded)
        g.selectAll('.data-dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'data-dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.pace))
            .attr('r', 3)
            .attr('fill', this.colors.primary)
            .attr('opacity', 0.3)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Date: ${d.date.toLocaleDateString()}<br/>Pace: ${this.secondsToPace(d.pace)}<br/>Distance: ${d.distance} km`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Trend line (smooth average)
        g.append('path')
            .datum(rollingAverage)
            .attr('class', 'trend-line')
            .attr('d', trendLine)
            .attr('fill', 'none')
            .attr('stroke', this.colors.secondary)
            .attr('stroke-width', 4)
            .attr('opacity', 0.8);

        // Trend line dots for hover interaction
        g.selectAll('.trend-dot')
            .data(rollingAverage)
            .enter().append('circle')
            .attr('class', 'trend-dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.avgPace))
            .attr('r', 5)
            .attr('fill', this.colors.secondary)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2)
            .attr('opacity', 0)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1);
            })
            .on('mouseout', function(event, d) {
                d3.select(this).attr('opacity', 0);
            });

        // Add legend
        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 120}, 20)`);

        legend.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 3)
            .attr('fill', this.colors.primary)
            .attr('opacity', 0.3);

        legend.append('text')
            .attr('x', 10)
            .attr('y', 0)
            .attr('dy', '0.32em')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Individual runs');

        legend.append('line')
            .attr('x1', -10)
            .attr('x2', 10)
            .attr('y1', 15)
            .attr('y2', 15)
            .attr('stroke', this.colors.secondary)
            .attr('stroke-width', 4)
            .attr('opacity', 0.8);

        legend.append('text')
            .attr('x', 15)
            .attr('y', 15)
            .attr('dy', '0.32em')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('5-day average');

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

    calculateRollingAverage(data, windowSize) {
        const result = [];
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
            
            const window = data.slice(start, end);
            const avgPace = window.reduce((sum, d) => sum + d.pace, 0) / window.length;
            
            result.push({
                date: data[i].date,
                avgPace: avgPace,
                originalPace: data[i].pace,
                distance: data[i].distance
            });
        }
        
        return result;
    }

    createCalendarChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        // Group activities by month
        const monthlyData = d3.rollup(
            activities,
            v => ({
                count: v.length,
                totalDistance: d3.sum(v, d => parseFloat(d.distanceKm)),
                avgDistance: d3.mean(v, d => parseFloat(d.distanceKm)),
                avgPace: d3.mean(v, d => this.paceToSeconds(d.averagePaceMinKm)),
                totalTime: d3.sum(v, d => d.movingTime),
                activities: v
            }),
            d => {
                const date = new Date(d.date + 'T00:00:00');
                return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            }
        );

        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const margin = { top: 20, right: 20, bottom: 40, left: 20 };
        const width = containerWidth - margin.left - margin.right;
        const height = 350 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', 350);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Convert to array and sort by date
        const monthsArray = Array.from(monthlyData, ([month, data]) => ({
            month: month,
            monthName: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            shortMonth: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
            ...data
        })).sort((a, b) => a.month.localeCompare(b.month));

        // Take last 12 months for better visibility
        const recentMonths = monthsArray.slice(-12);

        if (recentMonths.length === 0) {
            g.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', '#cccccc')
                .text('No monthly data available');
            return;
        }

        // Calculate grid layout
        const cols = Math.min(4, recentMonths.length);
        const rows = Math.ceil(recentMonths.length / cols);
        const cardWidth = (width - (cols - 1) * 15) / cols;
        const cardHeight = (height - (rows - 1) * 15) / rows;

        // Color scale based on total distance
        const maxDistance = d3.max(recentMonths, d => d.totalDistance);
        const colorScale = d3.scaleSequential(d3.interpolateOranges)
            .domain([0, maxDistance]);

        // Create month cards
        const monthCards = g.selectAll('.month-card')
            .data(recentMonths)
            .enter().append('g')
            .attr('class', 'month-card')
            .attr('transform', (d, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = col * (cardWidth + 15);
                const y = row * (cardHeight + 15);
                return `translate(${x},${y})`;
            });

        // Card backgrounds
        monthCards.append('rect')
            .attr('width', cardWidth)
            .attr('height', cardHeight)
            .attr('fill', d => d.totalDistance > 0 ? colorScale(d.totalDistance) : '#3a3a3a')
            .attr('stroke', '#555555')
            .attr('stroke-width', 1)
            .attr('rx', 8)
            .attr('ry', 8)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('stroke', '#fc4c02')
                    .attr('stroke-width', 2);
            })
            .on('mouseout', function(event, d) {
                d3.select(this)
                    .attr('stroke', '#555555')
                    .attr('stroke-width', 1);
            });

        // Month names
        monthCards.append('text')
            .attr('x', cardWidth / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', d => d.totalDistance > 50 ? '#000000' : '#ffffff')
            .text(d => d.shortMonth);

        // Total distance (large number)
        monthCards.append('text')
            .attr('x', cardWidth / 2)
            .attr('y', cardHeight / 2 + 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '24px')
            .style('font-weight', 'bold')
            .style('fill', d => d.totalDistance > 50 ? '#000000' : '#fc4c02')
            .text(d => d.totalDistance.toFixed(0));

        // "km" label
        monthCards.append('text')
            .attr('x', cardWidth / 2)
            .attr('y', cardHeight / 2 + 20)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', d => d.totalDistance > 50 ? '#333333' : '#cccccc')
            .text('km');

        // Number of runs
        monthCards.append('text')
            .attr('x', cardWidth / 2)
            .attr('y', cardHeight - 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', d => d.totalDistance > 50 ? '#333333' : '#cccccc')
            .text(d => `${d.count} runs`);

        // Average pace
        monthCards.append('text')
            .attr('x', cardWidth / 2)
            .attr('y', cardHeight - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', d => d.totalDistance > 50 ? '#666666' : '#999999')
            .text(d => d.avgPace ? this.secondsToPace(d.avgPace) + '/km' : '');

        // Add tooltips
        monthCards.on('mouseover', (event, d) => {
            this.tooltip.transition().duration(200).style('opacity', .9);
            this.tooltip.html(`
                <strong>${d.monthName}</strong><br/>
                Distance: ${d.totalDistance.toFixed(1)} km<br/>
                Runs: ${d.count}<br/>
                Avg Distance: ${d.avgDistance.toFixed(1)} km<br/>
                Avg Pace: ${this.secondsToPace(d.avgPace)}<br/>
                Total Time: ${Math.floor(d.totalTime / 3600)}h ${Math.floor((d.totalTime % 3600) / 60)}m
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
            this.tooltip.transition().duration(500).style('opacity', 0);
        });

        // Add title
        g.append('text')
            .attr('x', width / 2)
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('fill', '#cccccc')
            .style('font-weight', '500')
            .text('Monthly Running Summary');

        // Add legend
        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 120}, ${height - 30})`);

        // Create gradient for legend
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'distance-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('style', 'stop-color:#3a3a3a;stop-opacity:1');

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('style', 'stop-color:#ff8c00;stop-opacity:1');

        legend.append('rect')
            .attr('width', 60)
            .attr('height', 12)
            .style('fill', 'url(#distance-gradient)');

        legend.append('text')
            .attr('x', 0)
            .attr('y', 25)
            .style('font-size', '10px')
            .style('fill', '#cccccc')
            .text('0 km');

        legend.append('text')
            .attr('x', 35)
            .attr('y', 25)
            .style('font-size', '10px')
            .style('fill', '#cccccc')
            .text(`${maxDistance.toFixed(0)} km`);
    }

    createDistanceDistributionChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        // Create distance bins specifically for the challenge: 3km to 14km in 1km increments
        const challengeBins = [];
        for (let i = 3; i <= 14; i++) {
            challengeBins.push(i);
        }
        
        const binData = challengeBins.map(targetDistance => {
            // Find activities within 0.5km of the target distance (e.g., 3.0-3.9km for the 3km bin)
            const activitiesInBin = activities.filter(act => {
                const dist = parseFloat(act.distanceKm);
                return dist >= targetDistance && dist < targetDistance + 1;
            });
            
            const avgPace = activitiesInBin.length > 0 ? 
                d3.mean(activitiesInBin, d => this.paceToSeconds(d.averagePaceMinKm)) : 0;
            
            // Calculate expected count for this month (if following the challenge)
            const currentMonth = new Date().getMonth() + 1; // 1-12
            const targetMonth = targetDistance - 2; // 3km = month 1, 4km = month 2, etc.
            const isCurrentChallengeDistance = targetMonth === currentMonth;
            
            return {
                distance: targetDistance,
                label: `${targetDistance}km`,
                count: activitiesInBin.length,
                avgPace: avgPace,
                isTarget: isCurrentChallengeDistance,
                targetMonth: targetMonth <= 12 ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][targetMonth - 1] : null
            };
        });

        const margin = { top: 20, right: 30, bottom: 60, left: 50 }; // Extra bottom margin for labels
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
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('font-size', '11px');

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Bars with color coding
        g.selectAll('.bar')
            .data(binData)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.label))
            .attr('width', xScale.bandwidth())
            .attr('y', d => yScale(d.count))
            .attr('height', d => height - yScale(d.count))
            .attr('fill', d => {
                if (d.isTarget) return this.colors.success; // Current month target
                if (d.count > 0) return this.colors.secondary; // Completed distances
                return this.colors.primary; // Future/not attempted
            })
            .attr('opacity', d => d.count > 0 ? 1 : 0.3)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                const challengeInfo = d.targetMonth ? `<br/>Challenge month: ${d.targetMonth}` : '';
                const targetInfo = d.isTarget ? '<br/>🎯 Current target!' : '';
                this.tooltip.html(`Distance: ${d.label}<br/>Runs: ${d.count}<br/>Avg Pace: ${this.secondsToPace(d.avgPace)}${challengeInfo}${targetInfo}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Add month labels below distance labels
        g.selectAll('.month-label')
            .data(binData.filter(d => d.targetMonth))
            .enter().append('text')
            .attr('class', 'month-label')
            .attr('x', d => xScale(d.label) + xScale.bandwidth() / 2)
            .attr('y', height + 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('fill', '#999999')
            .text(d => d.targetMonth);

        // Labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 50)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Challenge Distance by Month');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Number of Runs');

        // Add legend
        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 150}, 20)`);

        // Current target
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', this.colors.success);

        legend.append('text')
            .attr('x', 18)
            .attr('y', 9)
            .style('font-size', '11px')
            .style('fill', '#cccccc')
            .text('Current target');

        // Completed
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 18)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', this.colors.secondary);

        legend.append('text')
            .attr('x', 18)
            .attr('y', 27)
            .style('font-size', '11px')
            .style('fill', '#cccccc')
            .text('Completed');

        // Not attempted
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 36)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', this.colors.primary)
            .attr('opacity', 0.3);

        legend.append('text')
            .attr('x', 18)
            .attr('y', 45)
            .style('font-size', '11px')
            .style('fill', '#cccccc')
            .text('Future target');
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

        // Create rolling average data for smoother trend line
        const rollingAverage = this.calculateRollingAverageHR(data, 5); // 5-day rolling average

        // Line generators
        const trendLine = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.avgHeartRate))
            .curve(d3.curveBasis); // Smooth curve

        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%m/%d')));

        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale));

        // Background data points (faded)
        g.selectAll('.data-dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'data-dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.heartRate))
            .attr('r', 3)
            .attr('fill', this.colors.danger)
            .attr('opacity', 0.3)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Date: ${d.date.toLocaleDateString()}<br/>Heart Rate: ${d.heartRate} bpm<br/>Distance: ${d.distance} km<br/>Pace: ${this.secondsToPace(d.pace)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Trend line (smooth average)
        g.append('path')
            .datum(rollingAverage)
            .attr('class', 'trend-line')
            .attr('d', trendLine)
            .attr('fill', 'none')
            .attr('stroke', this.colors.pink)
            .attr('stroke-width', 4)
            .attr('opacity', 0.8);

        // Trend line dots for hover interaction
        g.selectAll('.trend-dot')
            .data(rollingAverage)
            .enter().append('circle')
            .attr('class', 'trend-dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.avgHeartRate))
            .attr('r', 5)
            .attr('fill', this.colors.pink)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2)
            .attr('opacity', 0)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1);
            })
            .on('mouseout', function(event, d) {
                d3.select(this).attr('opacity', 0);
            });

        // Add legend
        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 120}, 20)`);

        legend.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 3)
            .attr('fill', this.colors.danger)
            .attr('opacity', 0.3);

        legend.append('text')
            .attr('x', 10)
            .attr('y', 0)
            .attr('dy', '0.32em')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Individual runs');

        legend.append('line')
            .attr('x1', -10)
            .attr('x2', 10)
            .attr('y1', 15)
            .attr('y2', 15)
            .attr('stroke', this.colors.pink)
            .attr('stroke-width', 4)
            .attr('opacity', 0.8);

        legend.append('text')
            .attr('x', 15)
            .attr('y', 15)
            .attr('dy', '0.32em')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('5-day average');

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

    calculateRollingAverageHR(data, windowSize) {
        const result = [];
        
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
            
            const window = data.slice(start, end);
            const avgHeartRate = window.reduce((sum, d) => sum + d.heartRate, 0) / window.length;
            
            result.push({
                date: data[i].date,
                avgHeartRate: avgHeartRate,
                originalHeartRate: data[i].heartRate,
                distance: data[i].distance,
                pace: data[i].pace
            });
        }
        
        return result;
    }

    createMapChart(activities, selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`Map container ${selector} not found, skipping map chart`);
            return;
        }

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

        // Check if Leaflet is available
        if (typeof L === 'undefined') {
            d3.select(selector).append('div')
                .style('padding', '20px')
                .style('text-align', 'center')
                .style('color', '#cccccc')
                .text('Map library not loaded');
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
            try {
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

            } catch (error) {
                console.error('Error creating map:', error);
                d3.select(selector).select('#' + mapId)
                    .html('<div style="padding: 20px; text-align: center; color: #cccccc;">Error loading map</div>');
            }
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

    createPersonalRecordsChart(activities, selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`PR chart container ${selector} not found, skipping chart`);
            return;
        }

        d3.select(selector).selectAll('*').remove();

        if (activities.length === 0) {
            d3.select(selector).append('div')
                .style('padding', '20px')
                .style('text-align', 'center')
                .style('color', '#cccccc')
                .text('No activity data available');
            return;
        }

        // Define standard distances for PR tracking
        const standardDistances = [
            { distance: 5, label: '5K', range: [4.5, 5.5] },
            { distance: 10, label: '10K', range: [9.5, 10.5] },
            { distance: 15, label: '15K', range: [14.5, 15.5] },
            { distance: 21.1, label: 'Half Marathon', range: [20.5, 21.6] }
        ];

        // Find PRs for each distance
        const personalRecords = standardDistances.map(std => {
            const relevantActivities = activities.filter(act => {
                const dist = parseFloat(act.distanceKm);
                return dist >= std.range[0] && dist <= std.range[1] && act.averagePaceMinKm !== '0:00';
            });

            if (relevantActivities.length === 0) return null;

            // Sort by pace (fastest first)
            const sortedByPace = relevantActivities.sort((a, b) => 
                this.paceToSeconds(a.averagePaceMinKm) - this.paceToSeconds(b.averagePaceMinKm)
            );

            // Find progression of PRs over time
            const prHistory = [];
            let currentBest = Infinity;

            sortedByPace.forEach(activity => {
                const pace = this.paceToSeconds(activity.averagePaceMinKm);
                if (pace < currentBest) {
                    currentBest = pace;
                    prHistory.push({
                        date: new Date(activity.date + 'T00:00:00'),
                        pace: pace,
                        distance: parseFloat(activity.distanceKm),
                        totalTime: activity.movingTime,
                        activity: activity
                    });
                }
            });

            return {
                distance: std.distance,
                label: std.label,
                currentPR: prHistory[prHistory.length - 1],
                history: prHistory,
                totalAttempts: relevantActivities.length
            };
        }).filter(pr => pr !== null);

        if (personalRecords.length === 0) {
            d3.select(selector).append('div')
                .style('padding', '20px')
                .style('text-align', 'center')
                .style('color', '#cccccc')
                .text('No standard distance PRs found');
            return;
        }

        const margin = { top: 40, right: 30, bottom: 60, left: 120 };
        const container = d3.select(selector);
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;
        const height = Math.max(300, personalRecords.length * 80) - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const yScale = d3.scaleBand()
            .domain(personalRecords.map(d => d.label))
            .range([0, height])
            .padding(0.3);

        const allDates = personalRecords.flatMap(pr => pr.history.map(h => h.date));
        const xScale = d3.scaleTime()
            .domain(d3.extent(allDates))
            .range([0, width]);

        // Add title
        g.append('text')
            .attr('x', width / 2)
            .attr('y', -20)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('fill', '#fc4c02')
            .style('font-weight', 'bold')
            .text('Personal Records Timeline');

        // Create timeline for each distance
        personalRecords.forEach((pr, index) => {
            const yPos = yScale(pr.label) + yScale.bandwidth() / 2;

            // Background line
            g.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', yPos)
                .attr('y2', yPos)
                .attr('stroke', '#444444')
                .attr('stroke-width', 2);

            // Distance label
            g.append('text')
                .attr('x', -10)
                .attr('y', yPos)
                .attr('text-anchor', 'end')
                .attr('dy', '0.35em')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .style('fill', '#ffffff')
                .text(pr.label);

            // PR progression line
            if (pr.history.length > 1) {
                const line = d3.line()
                    .x(d => xScale(d.date))
                    .y(d => yPos)
                    .curve(d3.curveStepAfter);

                g.append('path')
                    .datum(pr.history)
                    .attr('d', line)
                    .attr('stroke', this.colors.success)
                    .attr('stroke-width', 3)
                    .attr('fill', 'none');
            }

            // PR points
            g.selectAll(`.pr-point-${index}`)
                .data(pr.history)
                .enter().append('circle')
                .attr('class', `pr-point-${index}`)
                .attr('cx', d => xScale(d.date))
                .attr('cy', yPos)
                .attr('r', 6)
                .attr('fill', this.colors.success)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', (event, d) => {
                    this.tooltip.transition().duration(200).style('opacity', .9);
                    this.tooltip.html(`
                        <strong>${pr.label} PR</strong><br/>
                        Date: ${d.date.toLocaleDateString()}<br/>
                        Time: ${this.formatTimeHMS(d.totalTime)}<br/>
                        Pace: ${this.secondsToPace(d.pace)}/km<br/>
                        Distance: ${d.distance} km
                    `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', () => {
                    this.tooltip.transition().duration(500).style('opacity', 0);
                });

            // Current PR time display
            g.append('text')
                .attr('x', width + 10)
                .attr('y', yPos - 8)
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .style('fill', this.colors.success)
                .text(this.formatTimeHMS(pr.currentPR.totalTime));

            // Current PR pace
            g.append('text')
                .attr('x', width + 10)
                .attr('y', yPos + 8)
                .style('font-size', '10px')
                .style('fill', '#cccccc')
                .text(`${this.secondsToPace(pr.currentPR.pace)}/km`);
        });

        // Add time axis
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b %Y')))
            .selectAll('text')
            .style('font-size', '10px')
            .style('fill', '#cccccc');

        // Add legend
        const legend = g.append('g')
            .attr('transform', `translate(10, 10)`);

        legend.append('circle')
            .attr('r', 6)
            .attr('fill', this.colors.success);

        legend.append('text')
            .attr('x', 15)
            .attr('y', 5)
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Personal Record');
    }

    createTrainingLoadChart(activities, selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`Training load container ${selector} not found, skipping chart`);
            return;
        }

        d3.select(selector).selectAll('*').remove();

        if (activities.length === 0) {
            d3.select(selector).append('div')
                .style('padding', '20px')
                .style('text-align', 'center')
                .style('color', '#cccccc')
                .text('No activity data available');
            return;
        }

        // Calculate training load for each activity and group by week
        const weeklyLoad = this.calculateWeeklyTrainingLoad(activities);
        
        // Take last 12 weeks
        const recentWeeks = weeklyLoad.slice(-12);

        const margin = { top: 20, right: 30, bottom: 60, left: 50 };
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
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(recentWeeks, d => d.totalLoad)])
            .nice()
            .range([height, 0]);

        // Create stacked data for different load types
        const stack = d3.stack()
            .keys(['easyLoad', 'moderateLoad', 'hardLoad']);

        const stackedData = stack(recentWeeks);

        // Color scale for load intensity
        const loadColors = {
            easyLoad: this.colors.success,      // Green for easy
            moderateLoad: this.colors.warning,  // Yellow for moderate  
            hardLoad: this.colors.danger        // Red for hard
        };

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

        // Create stacked bars
        g.selectAll('.load-layer')
            .data(stackedData)
            .enter().append('g')
            .attr('class', 'load-layer')
            .attr('fill', d => loadColors[d.key])
            .selectAll('rect')
            .data(d => d)
            .enter().append('rect')
            .attr('x', d => xScale(d.data.week))
            .attr('y', d => yScale(d[1]))
            .attr('height', d => yScale(d[0]) - yScale(d[1]))
            .attr('width', xScale.bandwidth())
            .on('mouseover', (event, d) => {
                const weekData = d.data;
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`
                    <strong>Week: ${weekData.week}</strong><br/>
                    Total Load: ${weekData.totalLoad.toFixed(0)}<br/>
                    Easy: ${weekData.easyLoad.toFixed(0)}<br/>
                    Moderate: ${weekData.moderateLoad.toFixed(0)}<br/>
                    Hard: ${weekData.hardLoad.toFixed(0)}<br/>
                    Recovery Status: ${weekData.recoveryStatus}<br/>
                    Runs: ${weekData.runs}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        // Add recovery indicators above bars
        g.selectAll('.recovery-indicator')
            .data(recentWeeks)
            .enter().append('text')
            .attr('class', 'recovery-indicator')
            .attr('x', d => xScale(d.week) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.totalLoad) - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(d => {
                if (d.recoveryStatus === 'High Risk') return '⚠️';
                if (d.recoveryStatus === 'Moderate') return '⚡';
                return '✅';
            });

        // Labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 50)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Training Week');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#cccccc')
            .text('Training Load Score');

        // Add legend
        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 120}, 20)`);

        const legendItems = [
            { key: 'hardLoad', label: 'Hard', color: loadColors.hardLoad },
            { key: 'moderateLoad', label: 'Moderate', color: loadColors.moderateLoad },
            { key: 'easyLoad', label: 'Easy', color: loadColors.easyLoad }
        ];

        legendItems.forEach((item, i) => {
            legend.append('rect')
                .attr('x', 0)
                .attr('y', i * 18)
                .attr('width', 12)
                .attr('height', 12)
                .attr('fill', item.color);

            legend.append('text')
                .attr('x', 18)
                .attr('y', i * 18 + 9)
                .style('font-size', '11px')
                .style('fill', '#cccccc')
                .text(item.label);
        });

        // Recovery status legend
        legend.append('text')
            .attr('x', 0)
            .attr('y', 70)
            .style('font-size', '11px')
            .style('fill', '#cccccc')
            .text('✅ Good  ⚡ Moderate  ⚠️ Risk');
    }

    calculateWeeklyTrainingLoad(activities) {
        // Group activities by week
        const weekMap = d3.rollup(
            activities,
            v => v,
            d => d3.timeWeek(new Date(d.date + 'T00:00:00'))
        );

        return Array.from(weekMap, ([week, weekActivities]) => {
            const weekData = {
                week: d3.timeFormat('%m/%d')(week),
                runs: weekActivities.length,
                totalDistance: 0,
                easyLoad: 0,
                moderateLoad: 0,
                hardLoad: 0,
                totalLoad: 0
            };

            weekActivities.forEach(activity => {
                const distance = parseFloat(activity.distanceKm);
                const pace = this.paceToSeconds(activity.averagePaceMinKm);
                
                // Calculate training load based on distance and intensity
                let intensityMultiplier = 1;
                
                // Determine intensity based on pace (adjust these thresholds as needed)
                if (pace > 0) {
                    if (pace <= 300) { // < 5:00/km - Hard
                        intensityMultiplier = 3;
                        weekData.hardLoad += distance * intensityMultiplier;
                    } else if (pace <= 360) { // 5:00-6:00/km - Moderate
                        intensityMultiplier = 2;
                        weekData.moderateLoad += distance * intensityMultiplier;
                    } else { // > 6:00/km - Easy
                        intensityMultiplier = 1;
                        weekData.easyLoad += distance * intensityMultiplier;
                    }
                } else {
                    // If no pace data, assume moderate
                    intensityMultiplier = 1.5;
                    weekData.moderateLoad += distance * intensityMultiplier;
                }

                weekData.totalDistance += distance;
            });

            weekData.totalLoad = weekData.easyLoad + weekData.moderateLoad + weekData.hardLoad;

            // Determine recovery status
            if (weekData.totalLoad > 50 && weekData.hardLoad > 20) {
                weekData.recoveryStatus = 'High Risk';
            } else if (weekData.totalLoad > 30) {
                weekData.recoveryStatus = 'Moderate';
            } else {
                weekData.recoveryStatus = 'Good';
            }

            return weekData;
        }).sort((a, b) => new Date(a.week) - new Date(b.week));
    }

    formatTimeHMS(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
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