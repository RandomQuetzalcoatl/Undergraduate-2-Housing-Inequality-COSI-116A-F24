const width = "100%";
const height = "100%";

//Dictionaries
const years = [
  "1991 New York City Housing and Vacancy Survey Microdata",
  "1993 New York City Housing and Vacancy Survey Microdata",
  "1996 New York City Housing and Vacancy Survey Microdata",
  "1999 New York City Housing and Vacancy Survey Microdata",
  "2002 New York City Housing and Vacancy Survey Microdata",
  "2005 New York City Housing and Vacancy Survey Microdata",
  "2008 New York City Housing and Vacancy Survey Microdata",
  "2011 New York City Housing and Vacancy Survey Microdata",
  "2014 New York City Housing and Vacancy Survey Microdata",
  "2017 New York City Housing and Vacancy Survey Microdata",
  "2021 New York City Housing and Vacancy Survey Microdata",
];

const boroughMapping = {
  1: "Bronx",
  2: "Brooklyn",
  3: "Manhattan",
  4: "Queens",
  5: "Staten Island",
};

const occLabels = {
  1: "Occupied",
  2: "Vacant, available for rent",
  3: "Vacant, available for sale only",
  4: "Vacant, not available",
};

const attributeLabels = {
  RENT_AMOUNT_PAID: "Average Rent",
  OCC: "Net Vacancy Rate",
};

//Global Variables
let currentAttribute = "RENT_AMOUNT_PAID";
let currentYear = ["2021"];
let sliderYear = "2021";
let selectedBorough = null;

//Data Variables
const saveData = {
  boroughRentData: {},
  rentData: {},
  vacancyRateData: {},
  allUnitsData: {},
};

years.forEach((yearEntry) => {
  const year = yearEntry.split(" ")[0];
  saveData[year] = {
    allUnitsData: {},
    rentData: {},
    vacancyRateData: {},
    boroughRentData: {},
  };
});

const svg = d3
  .select("#map")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", "0 0 800 600")
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3
  .geoMercator()
  .center([-73.94, 40.7])
  .scale(40000)
  .translate([400, 300]);

const path = d3.geoPath().projection(projection);

// Initialization function
function initialize() {
  // Gets year slider and displays year
  const yearSlider = document.getElementById("year-slider");
  const yearDisplay = document.getElementById("year-display");
  currentYear = [years[yearSlider.value].split(" ")[0]]; // Updates global variable for year
  sliderYear = years[yearSlider.value].split(" ")[0];
  yearDisplay.textContent = currentYear[0];

  Promise.all(
    years.map((yearEntry) => {
      const year = yearEntry.split(" ")[0]; // Extract year from string
      if (year === "2021") {
        const allUnitsPath = `/data/${year}/allunits_puf_${year.slice(-2)}.csv`;
        const occupiedPath = `/data/${year}/occupied_puf_${year.slice(-2)}.csv`;

        return Promise.all([d3.csv(allUnitsPath), d3.csv(occupiedPath)]).then(
          ([allUnits, occupied]) => {
            allUnits = allUnits.map((d) => ({
              ...d,
              income: +d.HHINC_REC1 || 0, // Map HHINC_REC1 to income
            }));

            occupied = occupied.map((d) => ({
              ...d,
              income: +d.HHINC_REC1 || 0, // Map HHINC_REC1 to income
            }));

            const mergedRent = mergeRentData(allUnits, occupied, year);
            const vacancyRate = calculateVacancyRate(allUnits);
            saveData[year] = {
              allUnitsData: allUnits,
              rentData: mergedRent,
              vacancyRateData: vacancyRate,
              boroughRentData: saveData[year]["boroughRentData"], // Pre-populated in mergeRentData
            };
          }
        );
      } else {
        const occPath = `DATA/${year}/occ_data_${year}.csv`;
        const vacPath = `DATA/${year}/vac_data_${year}.csv`;

        return Promise.all([d3.csv(occPath), d3.csv(vacPath)]).then(
          ([occupied, vacant]) => {
            const allUnits = preprocessVacData(occupied, vacant);
            const rent = preprocessOccData(occupied, year);
            const vacancyRate = calculateVacancyRate(allUnits);
            saveData[year] = {
              allUnitsData: allUnits,
              rentData: rent,
              vacancyRateData: vacancyRate,
              boroughRentData: saveData[year]["boroughRentData"], // Pre-populated in preprocessOccData
            };
          }
        );
      }
    })
  )
    .then(() => {
      // Initializes graphs in a then so we no longer have the synchronicity errors
      loadAndUpdateMap(currentYear);
      renderDetailGraph();
      renderTimeGraph();
      renderScatterplot();

      // Add event listener to the year slider
      yearSlider.addEventListener("input", function () {
        const yearIndex = +yearSlider.value;
        currentYear = [years[yearIndex].split(" ")[0]];
        sliderYear = years[yearIndex].split(" ")[0];
        yearDisplay.textContent = currentYear[0];
        loadAndUpdateMap(currentYear);
        renderDetailGraph();
        resetTimeGraphHighlight();
        renderScatterplot();
      });

      // Add event listener for attribute changes
      d3.select("#color-attribute").on("change", function () {
        currentAttribute = d3.select(this).property("value"); //Updates global variable for attribute
        loadAndUpdateMap(currentYear); // Reload map with the current year
        renderDetailGraph();
        renderTimeGraph();
        renderScatterplot();
      });

      // Event listener for scale selection
      d3.select("#scale-select").on("change", () => {
        renderScatterplot(); // Re-render the scatterplot with the new scale
      });
    })
    .catch((error) => {
      console.error("Error loading data:", error);
    });
}

// Function to load and update the map based on the selected year
function loadAndUpdateMap(selectedYear) {
  d3.json("data/Borough Boundaries.geojson")
    .then((geoData) => {
      const mapData = {
        RENT_AMOUNT_PAID: averageRentData(
          selectedYearsData(selectedYear).rentData
        ),
        OCC: selectedYearsData(selectedYear).vacancyRateData,
      };

      updateMapColors(currentAttribute, mapData, geoData);
    })
    .catch((error) => console.error("Error loading data files:", error));
}

function updateMapColors(attribute, mapData, geoData) {
  const data = mapData[attribute];
  const maxValue = d3.max(Object.values(data));
  const colorScale = d3
    .scaleLinear()
    .domain([0, maxValue])
    .range(["#ffcccc", "#ff0000"]); //Light red to red

  document.getElementById("legend-min").textContent = "0";
  document.getElementById("legend-max").textContent = maxValue.toFixed(2);

  svg
    .selectAll(".borough")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("class", (d) =>
      d.properties.boro_name === selectedBorough
        ? "borough selected"
        : "borough"
    )
    .style("fill", (d) => {
      const boroName = d.properties.boro_name;
      return data[boroName] ? colorScale(data[boroName]) : "#ccc"; //missing data will be grey
    })
    .on("mouseover", function (event, d) {
      d3.select(this).style("fill", "orange");
    })
    .on("mouseout", function (event, d) {
      const boroName = d.properties.boro_name;
      d3.select(this).style(
        "fill",
        data[boroName] ? colorScale(data[boroName]) : "#ccc"
      );
    })
    .on("click", function (event, d) {
      const boroName = d.properties.boro_name;
      const isSelected = d3.select(this).classed("selected");

      svg.selectAll(".borough").classed("selected", false);
      if (!isSelected) {
        d3.select(this).classed("selected", true);
        selectedBorough = boroName;
      } else {
        selectedBorough = null;
      }
      renderDetailGraph();
      renderTimeGraph();
      renderScatterplot();
    })
    .each(function (d) {
      const boroName = d.properties.boro_name;
      const value = data[boroName] ? data[boroName].toFixed(2) : "N/A";
      const label = attributeLabels[attribute] || "Unknown Attribute";

      let title = d3.select(this).select("title");
      if (title.empty()) {
        title = d3.select(this).append("title");
      }
      title.text(`${boroName}\n${label}: ${value}`);
    });
}

//View functions

//Rent Amount
function mergeRentData(allUnitsData, occupiedData, year) {
  const rentMap = new Map();
  occupiedData.forEach((row) => {
    if (row.RENTPAID_AMOUNT > 0) {
      rentMap.set(row.CONTROL, {
        rent_paid: +row.RENTPAID_AMOUNT,
        income: +row.HHINC_REC1 || 0,
      });
    }
  });

  const mergedData = allUnitsData
    .filter((row) => rentMap.has(row.CONTROL))
    .map((row) => {
      const { rent_paid, income } = rentMap.get(row.CONTROL);
      return {
        boro_name: boroughMapping[row.BORO],
        rent_paid,
        income,
      };
    });

  saveData[year]["boroughRentData"] = mergedData.reduce((acc, row) => {
    if (!acc[row.boro_name]) acc[row.boro_name] = [];
    acc[row.boro_name].push(row.rent_paid);
    return acc;
  }, {});

  return mergedData;
}

//Rental Vacancy Rate
function calculateVacancyRate(allUnitsData) {
  const boroughStats = {};
  allUnitsData.forEach((row) => {
    const boroName = boroughMapping[row.BORO];
    if (!boroughStats[boroName]) {
      boroughStats[boroName] = { occupied: 0, vacant: 0 };
    }
    if (row.OCC === "1") {
      boroughStats[boroName].occupied += 1;
    } else if (row.OCC === "2") {
      boroughStats[boroName].vacant += 1;
    }
  });
  return Object.fromEntries(
    Object.entries(boroughStats).map(([boroName, stats]) => {
      const netVacancyRate = stats.vacant / (stats.occupied + stats.vacant);
      return [boroName, netVacancyRate];
    })
  );
}

function preprocessVacData(occData, vacData) {
  const processedOccData = occData.map((row) => ({
    ...row,
    OCC: "1",
    BORO: row.borough,
  }));

  const processedVacData = vacData.map((row) => ({
    ...row,
    OCC: (parseInt(row.vacancy_status, 10) + 1).toString(),
    BORO: row.borough,
  }));

  const allUnits = [...processedOccData, ...processedVacData];
  return allUnits;
}

function preprocessOccData(occData, year) {
  if (!Array.isArray(occData)) {
    console.error("Invalid input to preprocessOccData:", occData);
    boroughRentData = {};
    return [];
  }

  const processedData = occData
    .filter(
      (row) =>
        +row.gross_monthly_rent > 0 &&
        +row.gross_monthly_rent !== 9999 &&
        +row.gross_monthly_rent !== 9998 &&
        +row.gross_monthly_rent !== 99999
    )
    .map((row) => ({
      boro_name: boroughMapping[+row.borough],
      rent_paid: +row.gross_monthly_rent,
      income: +row.income,
    }));

  saveData[year]["boroughRentData"] = processedData.reduce((acc, row) => {
    if (!acc[row.boro_name]) {
      acc[row.boro_name] = [];
    }
    acc[row.boro_name].push(row.rent_paid);
    return acc;
  }, {});

  return processedData;
}

//Gets
function averageRentData(mergedData) {
  const boroughAggregates = {};
  mergedData.forEach((row) => {
    if (!boroughAggregates[row.boro_name]) {
      boroughAggregates[row.boro_name] = { totalRent: 0, count: 0 };
    }
    boroughAggregates[row.boro_name].totalRent += row.rent_paid;
    boroughAggregates[row.boro_name].count += 1;
  });

  return Object.fromEntries(
    Object.entries(boroughAggregates).map(([boro, { totalRent, count }]) => [
      boro,
      totalRent / count,
    ])
  );
}

// Create buckets
function createBuckets(data, step = 250) {
  const minRent = Math.floor(d3.min(data) / step) * step;
  const maxRent = Math.ceil(d3.max(data) / step) * step;
  const thresholds = d3.range(minRent, maxRent + step, step);
  return thresholds;
}

// Update the renderDetailGraph function
function renderDetailGraph() {
  const graphContainer = d3.select("#detail-graph");
  const graphSvg = graphContainer.select("svg");
  graphSvg.selectAll("*").remove(); // Clear existing graph

  graphContainer.select(".detail-graph-title").remove();

  // Add title should make a dictionary
  const title =
    currentAttribute === "RENT_AMOUNT_PAID"
      ? "Rent Distribution"
      : currentAttribute === "OCC"
      ? "Occupancy Distribution"
      : "Detail Graph";

  const subtitle = selectedBorough
    ? ` for ${selectedBorough}`
    : " for New York City";
  const graphWidth = parseInt(graphContainer.style("width"));
  const graphHeight = parseInt(graphContainer.style("height")) * 0.8;

  graphSvg.attr("width", graphWidth).attr("height", graphHeight);
  graphContainer
    .insert("h4", ":first-child")
    .attr("class", "detail-graph-title")
    .text(`${title}${subtitle}`);

  // Render graph, add any new views here
  if (currentAttribute === "RENT_AMOUNT_PAID") {
    renderRentGraph(selectedBorough);
  } else if (currentAttribute === "OCC") {
    renderOCCGraph(currentYear, selectedBorough);
  } else {
    graphSvg
      .append("text")
      .attr("x", "50%")
      .attr("y", "50%")
      .attr("text-anchor", "middle")
      .text("No data available for this attribute");
  }
}

function renderRentGraph(boroughName) {
  const rentGraphData = boroughName
    ? selectedYearsData(currentYear).boroughRentData[boroughName] || []
    : Object.values(selectedYearsData(currentYear).boroughRentData).flat();

  if (rentGraphData.length === 0) {
    d3.select("#detail-graph svg")
      .append("text")
      .attr("x", "50%")
      .attr("y", "50%")
      .attr("text-anchor", "middle")
      .text("No data available");
    return;
  }

  const thresholds = createBuckets(rentGraphData, 500); //Bucket size is how large the groupings are, can be edited to have more or less
  const buckets = d3.bin().thresholds(thresholds)(rentGraphData);

  const graphSvg = d3.select("#detail-graph svg");
  const width = +graphSvg.style("width").replace("px", "");
  const height = +graphSvg.style("height").replace("px", "");
  const margin = { top: 20, right: 20, bottom: 60, left: 40 };

  const x = d3
    .scaleBand()
    .domain(buckets.map((d) => `$${d.x0}-${d.x1}`))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(buckets, (d) => d.length)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y);

  graphSvg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  graphSvg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis);

  graphSvg
    .selectAll(".bar")
    .data(buckets)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(`$${d.x0}-${d.x1}`))
    .attr("y", (d) => y(d.length))
    .attr("width", x.bandwidth())
    .attr("height", (d) => height - margin.bottom - y(d.length))
    .attr("fill", "#69b3a2")
    .append("title")
    .text((d) => `Range: $${d.x0} - $${d.x1}\nCount: ${d.length}`);
}

function calculateOccDistribution(allUnitsData, boroughName) {
  const occCounts = {};
  allUnitsData.forEach((row) => {
    const boroName = boroughMapping[row.BORO];
    if (boroughName === null || boroName === boroughName) {
      const occType = row.OCC;
      if (!occCounts[occType]) {
        occCounts[occType] = 0;
      }
      occCounts[occType] += 1;
    }
  });

  return Object.entries(occCounts).map(([key, value]) => ({
    label: key,
    count: value,
  }));
}

function renderOCCGraph(year, boroughName) {
  const occData = calculateOccDistribution(
    selectedYearsData(year).allUnitsData,
    boroughName
  );
  const graphSvg = d3.select("#detail-graph svg");
  graphSvg.selectAll("*").remove();

  if (occData.length === 0) {
    graphSvg
      .append("text")
      .attr("x", "50%")
      .attr("y", "50%")
      .attr("text-anchor", "middle")
      .text("No data available");
    return;
  }

  const width = +graphSvg.style("width").replace("px", "");
  const height = +graphSvg.style("height").replace("px", "");
  const margin = { top: 20, right: 20, bottom: 60, left: 40 };

  const x = d3
    .scaleBand()
    .domain(occData.map((d) => occLabels[d.label] || `OCC ${d.label}`))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(occData, (d) => d.count)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y);

  graphSvg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  graphSvg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis);

  graphSvg
    .selectAll(".bar")
    .data(occData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(occLabels[d.label] || `OCC ${d.label}`))
    .attr("y", (d) => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", (d) => height - margin.bottom - y(d.count))
    .attr("fill", "#69b3a2")
    .append("title")
    .text(
      (d) => `${occLabels[d.label] || `OCC ${d.label}`}\nCount: ${d.count}`
    );
}

//May implement brushing with this, where it overwrites the time slider with whatever years are selected
//Would need a fair bit of work to make the other functions be able to process multiple years together
function renderTimeGraph() {
  const graphContainer = d3.select("#time-chart");
  const graphSvg = graphContainer.select("svg");
  graphSvg.selectAll("*").remove();

  graphContainer.select(".time-chart-title").remove();

  //Chooses title based on attribute and whether a borough is selected
  const title =
    currentAttribute === "RENT_AMOUNT_PAID"
      ? `Average Rent Over Time${
          selectedBorough ? ` for ${selectedBorough}` : ""
        }`
      : currentAttribute === "OCC"
      ? `Net Vacancy Rate Over Time${
          selectedBorough ? ` for ${selectedBorough}` : ""
        }`
      : "Line Chart";

  const graphWidth = parseInt(graphContainer.style("width"));
  const graphHeight = parseInt(graphContainer.style("height")) * 0.8;

  graphSvg.attr("width", graphWidth).attr("height", graphHeight);
  graphContainer
    .insert("h4", ":first-child")
    .attr("class", "time-chart-title")
    .text(title);

  //Gets all the entries from global variable saveData
  const timeData = years
    .map((yearEntry) => {
      const year = yearEntry.split(" ")[0];
      const data = saveData[year];
      if (!data) return null;

      if (currentAttribute === "RENT_AMOUNT_PAID") {
        //will do overall average rent for year
        const boroughData = selectedBorough
          ? data.boroughRentData[selectedBorough]
          : Object.values(data.boroughRentData).flat();
        const avgRent =
          boroughData && boroughData.length > 0 ? d3.mean(boroughData) : null;
        return avgRent !== null ? { year, value: avgRent } : null;
      } else if (currentAttribute === "OCC") {
        //will do overall average net vacancy rate for year
        if (selectedBorough) {
          const boroughUnits = data.allUnitsData.filter(
            (d) => boroughMapping[d.BORO] === selectedBorough
          );
          const vacancyRates = boroughUnits.map((d) => (d.OCC === "2" ? 1 : 0));
          const avgVacancy =
            vacancyRates.length > 0 ? d3.mean(vacancyRates) : null;
          return avgVacancy !== null ? { year, value: avgVacancy } : null;
        } else {
          const avgVacancy = d3.mean(Object.values(data.vacancyRateData));
          return avgVacancy !== null ? { year, value: avgVacancy } : null;
        }
      }
      return null;
    })
    .filter((d) => d !== null);

  if (timeData.length === 0) {
    graphSvg
      .append("text")
      .attr("x", "50%")
      .attr("y", "50%")
      .attr("text-anchor", "middle")
      .text("No data available for this attribute");
    return;
  }

  const x = d3
    .scaleLinear()
    .domain(d3.extent(timeData, (d) => +d.year))
    .range([50, graphWidth - 50]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(timeData, (d) => d.value)])
    .nice()
    .range([graphHeight - 50, 50]);

  const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));
  const yAxis = d3.axisLeft(y);

  graphSvg
    .append("g")
    .attr("transform", `translate(0, ${graphHeight - 50})`)
    .call(xAxis);

  graphSvg.append("g").attr("transform", "translate(50, 0)").call(yAxis);

  const line = d3
    .line()
    .x((d) => x(+d.year))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  graphSvg
    .append("path")
    .datum(timeData)
    .attr("fill", "none")
    .attr("stroke", "#69b3a2")
    .attr("stroke-width", 2)
    .attr("d", line);

  graphSvg
    .selectAll(".point")
    .data(timeData)
    .enter()
    .append("circle")
    .attr("class", "point")
    .attr("cx", (d) => x(+d.year))
    .attr("cy", (d) => y(d.value))
    .attr("r", 4)
    .attr("fill", "#69b3a2")
    .append("title")
    .text((d) => `Year: ${d.year}\nValue: ${d.value.toFixed(2)}`);

  const brush = d3
    .brushX()
    .extent([
      [50, 50],
      [graphWidth - 50, graphHeight - 50],
    ])
    .on("end", brushed);

  graphSvg.append("g").attr("class", "brush").call(brush);

  // Brush event handler
  function brushed({ selection }) {
    if (!selection) return;

    const [x0, x1] = selection.map(x.invert);
    const selectedYears = timeData.filter((d) => d.year >= x0 && d.year <= x1);
    const yearsSelected = selectedYears.map((d) => d.year);

    highlightSelectedPoints(yearsSelected);
    currentYear = yearsSelected;
    //renderScatterplot(yearsSelected);
    loadAndUpdateMap(yearsSelected); // Optionally update map
    renderDetailGraph();
  }

  // Highlight only points
  function highlightSelectedPoints(yearsSelected) {
    graphSvg
      .selectAll(".point")
      .attr("fill", (d) =>
        yearsSelected.includes(d.year) ? "orange" : "#69b3a2"
      );
  }
}

// ------------------------ Implementation of Scatterplot------------------------
// ------I am using https://d3-graph-gallery.com/graph/scatter_tooltip.html as a reference for the scatterplot implementation
function renderScatterplot() {
  const graphContainer = d3.select("#scatterplot");
  const graphSvg = graphContainer.select("svg");
  graphSvg.selectAll("*").remove();

  const graphWidth = parseInt(graphContainer.style("width"));
  const graphHeight = parseInt(graphContainer.style("height")) * 0.8;
  const margin = { top: 20, right: 20, bottom: 60, left: 60 };

  graphSvg.attr("width", graphWidth).attr("height", graphHeight);

  const combinedData = selectedYearsData(currentYear);
  const rentData = combinedData.rentData;

  const scaleType = d3.select("#scale-select").property("value");

  //Color boroughs differently
  const colorScale = d3
    .scaleOrdinal()
    .domain(Object.values(boroughMapping))
    .range(d3.schemeCategory10);

  if (currentAttribute === "RENT_AMOUNT_PAID") {
    const scatterData = rentData.filter((d) => d.income > 0 && d.rent_paid > 0);

    const x =
      scaleType === "logarithmic"
        ? d3
            .scaleLog()
            .base(10)
            .domain([
              Math.max(
                1,
                d3.min(scatterData, (d) => +d.income)
              ),
              d3.max(scatterData, (d) => +d.income),
            ])
            .range([margin.left, graphWidth - margin.right])
        : d3
            .scaleLinear()
            .domain([0, d3.max(scatterData, (d) => +d.income)])
            .nice()
            .range([margin.left, graphWidth - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(scatterData, (d) => +d.rent_paid)])
      .nice()
      .range([graphHeight - margin.bottom, margin.top]);

    graphSvg
      .append("g")
      .attr("transform", `translate(0,${graphHeight - margin.bottom})`)
      .call(
        d3.axisBottom(x).ticks(10, scaleType === "logarithmic" ? ".0s" : "s")
      );

    graphSvg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(10));

    // Scatterplot points
    const dots = graphSvg
      .selectAll(".dot")
      .data(scatterData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => x(+d.income))
      .attr("cy", (d) => y(+d.rent_paid))
      .attr("r", 4)
      .attr("fill", (d) => colorScale(d.boro_name))
      .attr("opacity", (d) =>
        !selectedBorough || d.boro_name === selectedBorough ? 0.7 : 0.1
      )
      .append("title")
      .text(
        (d) =>
          `Borough: ${d.boro_name}\nIncome: $${d.income}\nRent Paid: $${d.rent_paid}`
      );

    // Raise dots from selected borough
    if (selectedBorough) {
      graphSvg
        .selectAll(".dot")
        .filter((d) => d.boro_name === selectedBorough)
        .each(function () {
          d3.select(this).raise();
        });
    }

    // Add labels
    graphSvg
      .append("text")
      .attr("x", graphWidth / 2)
      .attr("y", graphHeight - 10)
      .attr("text-anchor", "middle")
      .text("Income");

    graphSvg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -graphHeight / 2)
      .attr("y", margin.left / 3)
      .attr("text-anchor", "middle")
      .text("Rent Paid");
  } else {
    graphSvg
      .append("text")
      .attr("x", graphWidth / 2)
      .attr("y", graphHeight / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .style("font-size", "16px")
      .text("No plot available for this attribute");
    return;
  }
}

function selectedYearsData(selectedYears) {
  // If only one year is selected, return its data directly
  if (selectedYears.length === 1) {
    const year = selectedYears[0];
    return saveData[year] || {};
  }
  //if nothing is selected, default to slider
  if (selectedYears.length === 0) {
    return saveData[sliderYear];
  }

  // Initialize combined data structure
  const combinedData = {
    rentData: [],
    allUnitsData: [],
    vacancyRateData: {},
    boroughRentData: {},
  };

  selectedYears.forEach((year) => {
    const yearData = saveData[year];
    if (!yearData) return;

    combinedData.rentData = fusionDance(
      combinedData.rentData,
      yearData.rentData
    );
    combinedData.allUnitsData = fusionDance(
      combinedData.allUnitsData,
      yearData.allUnitsData
    );
    combinedData.boroughRentData = fusionDance(
      combinedData.boroughRentData,
      yearData.boroughRentData
    );
  });

  combinedData.vacancyRateData = calculateVacancyRate(
    combinedData.allUnitsData
  );
  return combinedData;
}

function fusionDance(target, source) {
  if (Array.isArray(source)) {
    return target.concat(source);
  } else if (typeof source === "object" && source !== null) {
    Object.entries(source).forEach(([key, value]) => {
      if (!target[key]) {
        target[key] = Array.isArray(value) ? [] : {};
      }
      target[key] = fusionDance(target[key], value);
    });
    return target;
  }
  return target;
}

function resetTimeGraphHighlight() {
  const graphSvg = d3.select("#time-chart svg");
  graphSvg.select(".brush").call(d3.brush().move, null);
  graphSvg.selectAll(".point").attr("fill", "#69b3a2");
  loadAndUpdateMap(currentYear);
  renderDetailGraph();
  //renderScatterplot();
}
// Initialize graphs
initialize();
