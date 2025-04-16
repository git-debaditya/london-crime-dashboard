document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("darkModeToggle").addEventListener("change", function () {
            document.body.classList.toggle("dark-mode", this.checked);
    });
    const margin = { top: 20, right: 60, bottom: 50, left: 150 },
                width = 1380 - margin.left - margin.right,
                height = 600 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const chartArea = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("#tooltip");
    let currentPalette = 'default';

    const palettes = {
        default: ["#006400", "#32CD32", "#FFD700", "#FF8C00", "#8B0000"],
        colorblind: ["#440154", "#31688e", "#35b779", "#fde725", "#ff9100"]
    };

    d3.csv("crime_data_filtered.csv").then(rawData => {
        rawData = rawData.filter(d => d.Measure === "Offences");

        const nested = d3.rollup(
            rawData,
            v => d3.sum(v, d => +d.Count),
            d => d["Offence Group"],
            d => d["Area name"]
        );

        const offenceGroups = Array.from(nested.keys()).sort();
        const dropdown = d3.select("#offence-select");
        const paletteSelect = d3.select("#palette-select");

        dropdown.selectAll("option")
            .data(offenceGroups)
            .join("option")
            .attr("value", d => d)
            .text(d => d);

        let firstLoad = true;

        updateChart(offenceGroups[0], true);

        dropdown.on("change", function () {
            updateChart(this.value, false);
        });

        paletteSelect.on("change", function () {
            currentPalette = this.value;
            updateChart(dropdown.property("value"), false);
        });

        function updateChart(offenceType, isInitial) {
            const boroughData = Array.from(nested.get(offenceType) || [])
                .map(([area, count]) => ({ area, count }))
                .sort((a, b) => d3.descending(a.count, b.count))
                .slice(0, 10);

            const maxVal = d3.max(boroughData, d => d.count);

            const x = d3.scaleLinear()
                .domain([0, maxVal * 1.1])
                .range([0, width]);

            const y = d3.scaleBand()
                .domain(boroughData.map(d => d.area))
                .range([0, height])
                .padding(0.1);

            const xTicks = x.ticks(5);

            const legendTicks = d3.select("#legend-ticks");
            legendTicks.selectAll("div")
                .data(xTicks)
                .join("div")
                .style("text-align", "center")
                .style("width", "auto")
                .style("flex", 1)
                .text(d => Math.round(d));

            //Normal Palette
            const legendBar = d3.select("#legend-bar");
            const palette = palettes[currentPalette];
            legendBar.style("background", `linear-gradient(to right, ${palette.join(", ")})`);

            const colorScale = d3.scaleLinear()
                .domain([0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal])
                .range(palette);

            // Toggle legend bar visibility
            d3.select("#legend-bar").style("display", currentPalette === 'default' ? "block" : "none");
            d3.select("#legend-bar-cblind").style("display", currentPalette === 'colorblind' ? "block" : "none");

            chartArea.selectAll(".x-axis, .y-axis, .label, .zoom-label, .x-label, .y-label").remove();

            chartArea.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0, ${height})`)
                .call(d3.axisBottom(x).ticks(5))
                .selectAll("text")
                .style("font-size", "12px");

            chartArea.append("text")
                .attr("class", "x-label axis-label")
                .attr("x", width / 2)
                .attr("y", height + 40)
                .attr("text-anchor", "middle")
                .text("Number of Offences");

            chartArea.append("g")
                .attr("class", "y-axis")
                .call(d3.axisLeft(y))
                .selectAll("text")
                .style("font-size", "12px");

            chartArea.append("text")
                .attr("class", "y-label axis-label")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -margin.left + 20)
                .attr("text-anchor", "middle")
                .text("Boroughs");

            // --- BAR TRANSITION LOGIC ---
            const bars = chartArea.selectAll(".bar")
                .data(boroughData, d => d.area);

            // ENTER
            const barsEnter = bars.enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", 0)
                .attr("y", d => y(d.area))
                .attr("height", y.bandwidth())
                .attr("width", 0)
                .style("fill", d => colorScale(d.count))
                .on("mouseover", (event, d) => {
                    tooltip.style("opacity", 1)
                    .html(`<strong>${d.area}</strong> reported<br><b>${d.count.toLocaleString()} cases between Feb 2020 and Jan 2025.</b>`)
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 28}px`)
                    .style("opacity", 1);
                })
                .on("mouseout", () => tooltip.style("opacity", 0));
                
            // Initial load: staggered transition
            if (isInitial) {
                barsEnter.transition()
                    .delay((d, i) => i * 120)
                    .duration(800)
                    .attr("width", d => x(d.count));
            } else {
                barsEnter.transition()
                    .duration(800)
                    .attr("width", d => x(d.count));
            }

            // UPDATE
            bars.transition()
                .duration(900)
                .attr("y", d => y(d.area))
                .attr("height", y.bandwidth())
                .attr("width", d => x(d.count))
                .style("fill", d => colorScale(d.count));

            // EXIT
            bars.exit()
                .transition()
                .duration(500)
                .attr("width", 0)
                .remove();

            // --- LABELS TRANSITION LOGIC ---
            const labels = chartArea.selectAll(".label")
                .data(boroughData, d => d.area);

            labels.enter()
                .append("text")
                .attr("class", "label")
                .attr("x", d => x(0) + 5)
                .attr("y", d => y(d.area) + y.bandwidth() / 2 + 5)
                .text(d => d.count)
                .style("opacity", 0)
                .transition()
                .delay((d, i) => isInitial ? i * 120 + 200 : 0)
                .duration(800)
                .attr("x", d => x(d.count) + 5)
                .style("opacity", 1);

            labels.transition()
                .duration(900)
                .attr("x", d => x(d.count) + 5)
                .attr("y", d => y(d.area) + y.bandwidth() / 2 + 5)
                .text(d => d.count);

            labels.exit()
                .transition()
                .duration(500)
                .style("opacity", 0)
                .remove();
        }
    });
});