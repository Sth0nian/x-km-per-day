class RunningCharts {
    constructor() {
        this.tooltip = this.createTooltip();
        this.colors = {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb',
            success: '#4facfe',
            warning: '#f6d365',
            danger: '#fa709a'
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
            .domain(weeklyData.map(d => d.week))
            .range([0, width])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(weeklyData, d => d.distance)])
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
            .data(weeklyData)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.week))
            .attr('width', xScale.bandwidth())
            .attr('y', d => yScale(d.distance))
            .attr('height', d => height - yScale(d.distance))
            .attr('fill', this.colors.primary)
            .on('mouseover', (event, d) => {
                this.tooltip.transition().duration(200).style('opacity', .9);
                this.tooltip.html(`Week: ${d.week}<br/>Distance: ${d.distance.toFixed(1)} mi<br/>Runs: ${d.count}`)
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
            .text('Distance (miles)');
    }

    createPaceTrendChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        const data = activities
            .filter(d => d.averagePaceMinMile !== '0:00')
            .map(d => ({
                date: new Date(d.date),
                pace: this.paceToSeconds(d.averagePaceMinMile),
                distance: parseFloat(d.distanceMiles)
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
                this.tooltip.html(`Date: ${d.date.toLocaleDateString()}<br/>Pace: ${this.secondsToPace(d.pace)}<br/>Distance: ${d.distance} mi`)
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
            .text('Pace (min/mile)');
    }

    createCalendarChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        // Group activities by date
        const dailyData = d3.rollup(
            activities,
            v => ({
                count: v.length,
                distance: d3.sum(v, d => parseFloat(d.distanceMiles))
            }),
            d => d3.timeDay(new Date(d.date))
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
                    this.tooltip.html(`${d.toLocaleDateString()}<br/>Distance: ${data.distance.toFixed(1)} mi<br/>Runs: ${data.count}`)
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
        const distances = activities.map(d => parseFloat(d.distanceMiles));
        const bins = [0, 3, 5, 7, 10, 15, 20, Infinity];
        const binLabels = ['0-3', '3-5', '5-7', '7-10', '10-15', '15-20', '20+'];
        
        const binData = bins.slice(0, -1).map((bin, i) => ({
            label: binLabels[i],
            count: distances.filter(d => d >= bin && d < bins[i + 1]).length
        }));

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
            .attr('fill', this.colors.secondary);

        // Labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Distance Range (miles)');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Number of Runs');
    }

    createElevationChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        const data = activities
            .filter(d => d.totalElevationGain > 0)
            .map(d => ({
                distance: parseFloat(d.distanceMiles),
                elevation: d.totalElevationGain * 3.28084 // Convert to feet
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
                this.tooltip.html(`Distance: ${d.distance} mi<br/>Elevation: ${Math.round(d.elevation)} ft`)
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
            .text('Distance (miles)');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Elevation Gain (feet)');
    }

    createHeartRateChart(activities, selector) {
        d3.select(selector).selectAll('*').remove();

        const data = activities
            .filter(d => d.averageHeartrate)
            .map(d => ({
                date: new Date(d.date),
                heartRate: d.averageHeartrate,
                distance: parseFloat(d.distanceMiles)
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
                this.tooltip.html(`Date: ${d.date.toLocaleDateString()}<br/>Heart Rate: ${d.heartRate} bpm<br/>Distance: ${d.distance} mi`)
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
            .text('Average Heart Rate (bpm)');
    }

    // Helper methods
    groupActivitiesByWeek(activities) {
        const weekMap = d3.rollup(
            activities,
            v => ({
                distance: d3.sum(v, d => parseFloat(d.distanceMiles)),
                count: v.length
            }),
            d => d3.timeWeek(new Date(d.date))
        );

        return Array.from(weekMap, ([week, data]) => ({
            week: d3.timeFormat('%m/%d')(week),
            distance: data.distance,
            count: data.count
        })).sort((a, b) => new Date(a.week) - new Date(b.week));
    }

    paceToSeconds(paceString) {
        const [minutes, seconds] = paceString.split(':').map(Number);
        return minutes * 60 + seconds;
    }

    secondsToPace(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}