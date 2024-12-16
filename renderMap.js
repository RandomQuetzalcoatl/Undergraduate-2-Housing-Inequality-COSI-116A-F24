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
  "2021 New York City Housing and Vacancy Survey Microdata"
];

const boroughMapping = {
  1: "Bronx",
  2: "Brooklyn",
  3: "Manhattan",
  4: "Queens",
  5: "Staten Island"
};

const occLabels = {
  1: "Occupied",
  2: "Vacant, available for rent",
  3: "Vacant, available for sale only",
  4: "Vacant, not available"
};

const attributeLabels = {
  RENT_AMOUNT_PAID: "Average Rent",
  OCC: "Net Vacancy Rate"
};

//Global Variables
let currentAttribute = "RENT_AMOUNT_PAID"; 
let currentYear = "2021";
let selectedBorough = null;

//Data Variables
const saveData = {
  boroughRentData: {},
  rentData: {},
  vacancyRateData: {},
  allUnitsData: {},
};

years.forEach(yearEntry => {
  const year = yearEntry.split(" ")[0];
  saveData[year] = {
    allUnitsData: {},
    rentData: {},
    vacancyRateData: {},
    boroughRentData: {},
  };
});

const svg = d3.select("#map")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", "0 0 800 600")
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3.geoMercator()
  .center([-73.94, 40.70])
  .scale(40000)
  .translate([400, 300]);

const path = d3.geoPath().projection(projection);

// Initialization function
function initialize() {
  // Gets year slider and displays year
    const yearSlider = document.getElementById("year-slider");
    const yearDisplay = document.getElementById("year-display");
    currentYear = years[yearSlider.value].split(" ")[0]; // Updates global variable for year
    yearDisplay.textContent = currentYear;

    Promise.all(years.map((yearEntry, index) => {
      const year = yearEntry.split(" ")[0]; // Extract year from string
      if (year === "2021") {
        const allUnitsPath = `/data/${year}/allunits_puf_${year.slice(-2)}.csv`;
        const occupiedPath = `/data/${year}/occupied_puf_${year.slice(-2)}.csv`;
  
        return Promise.all([d3.csv(allUnitsPath), d3.csv(occupiedPath)]).then(([allUnits, occupied]) => {
          const mergedRent = mergeRentData(allUnits, occupied, year);
          const vacancyRate = calculateVacancyRate(allUnits);
          saveData[year] = {
            allUnitsData: allUnits,
            rentData: mergedRent,
            vacancyRateData: vacancyRate,
            boroughRentData: saveData[year]["boroughRentData"], // Pre-populated in mergeRentData
          };
        });
      } else {
        const occPath = `DATA/${year}/occ_data_${year}.csv`;
        const vacPath = `DATA/${year}/vac_data_${year}.csv`;
  
        return Promise.all([d3.csv(occPath), d3.csv(vacPath)]).then(([occupied, vacant]) => {
          const allUnits = preprocessVacData(occupied, vacant);
          const rent = preprocessOccData(occupied, year);
          const vacancyRate = calculateVacancyRate(allUnits);
          saveData[year] = {
            allUnitsData: allUnits,
            rentData: rent,
            vacancyRateData: vacancyRate,
            boroughRentData: saveData[year]["boroughRentData"], // Pre-populated in preprocessOccData
          };
        });
      }
    }))

  // Add event listener to the year slider
  yearSlider.addEventListener("input", function () {
    const yearIndex = +yearSlider.value;
    currentYear = years[yearIndex].split(" ")[0];
    yearDisplay.textContent = currentYear;
    loadAndUpdateMap(currentYear);
    renderDetailGraph();
  });

  // Add event listener for attribute changes
  d3.select("#color-attribute").on("change", function () {
    currentAttribute = d3.select(this).property("value"); //Updates global variable for attribute
    loadAndUpdateMap(currentYear); // Reload map with the current year
    renderDetailGraph();
  });
  
  // Initializes map with current year
  loadAndUpdateMap(currentYear);
  renderDetailGraph();
}

// Function to load and update the map based on the selected year
function loadAndUpdateMap(selectedYear) {
  d3.json("data/Borough Boundaries.geojson").then(geoData => {
      const mapData = {
        RENT_AMOUNT_PAID: averageRentData(saveData[selectedYear].rentData),
        OCC: saveData[selectedYear].vacancyRateData
      };

      updateMapColors(currentAttribute, mapData, geoData);
    }).catch(error => console.error("Error loading data files:", error));
}

function updateMapColors(attribute, mapData, geoData) {
  const data = mapData[attribute];
  const maxValue = d3.max(Object.values(data));
  const colorScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range(["#ffcccc", "#ff0000"]); //Light red to red

  document.getElementById("legend-min").textContent = "0";
  document.getElementById("legend-max").textContent = maxValue.toFixed(2);

  svg.selectAll(".borough")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("class", "borough")
    .style("fill", d => {
      const boroName = d.properties.boro_name;
      return data[boroName] ? colorScale(data[boroName]) : "#ccc"; //missing data will be grey
    })
    .on("mouseover", function (event, d) {
      d3.select(this).style("fill", "orange");
    })
    .on("mouseout", function (event, d) {
      const boroName = d.properties.boro_name;
      d3.select(this).style("fill", data[boroName] ? colorScale(data[boroName]) : "#ccc");
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
    })
    .each(function (d) { //ensures tooltip is updated
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
  occupiedData.forEach(row => {
    if (row.RENTPAID_AMOUNT > 0) {
      rentMap.set(row.CONTROL, +row.RENTPAID_AMOUNT);
    }
  });

  const mergedData = allUnitsData
    .filter(row => rentMap.has(row.CONTROL))
    .map(row => ({
      boro_name: boroughMapping[row.BORO],
      rent_paid: rentMap.get(row.CONTROL)
    }));

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
  allUnitsData.forEach(row => {
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
  const processedOccData = occData.map(row => ({
    ...row,
    OCC: "1",
    BORO: row.borough 
  }));

  const processedVacData = vacData.map(row => ({
    ...row,
    OCC: (parseInt(row.vacancy_status, 10) + 1).toString(),
    BORO: row.borough
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
    .filter(row => +row.gross_monthly_rent > 0 && +row.gross_monthly_rent !== 9999 && +row.gross_monthly_rent !== 9998 && +row.gross_monthly_rent !== 99999) 
    .map(row => ({
      boro_name: boroughMapping[+row.borough], 
      rent_paid: +row.gross_monthly_rent  
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
  mergedData.forEach(row => {
    if (!boroughAggregates[row.boro_name]) {
      boroughAggregates[row.boro_name] = { totalRent: 0, count: 0 };
    }
    boroughAggregates[row.boro_name].totalRent += row.rent_paid;
    boroughAggregates[row.boro_name].count += 1;
  });

  return Object.fromEntries(
    Object.entries(boroughAggregates).map(([boro, { totalRent, count }]) => [boro, totalRent / count])
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
  const title = currentAttribute === "RENT_AMOUNT_PAID"
    ? "Rent Distribution"
    : currentAttribute === "OCC"
    ? "Occupancy Distribution"
    : "Detail Graph";

  const subtitle = selectedBorough ? ` for ${selectedBorough}` : " for New York City";
  const graphWidth = parseInt(graphContainer.style("width"));
  const graphHeight = parseInt(graphContainer.style("height"))*0.8;

  graphSvg
    .attr("width", graphWidth)
    .attr("height", graphHeight);
  graphContainer.insert("h4", ":first-child")
    .attr("class", "detail-graph-title")
    .text(`${title}${subtitle}`);

  // Render graph, add any new views here
  if (currentAttribute === "RENT_AMOUNT_PAID") {
    renderRentGraph(selectedBorough);
  } else if (currentAttribute === "OCC") {
    renderOCCGraph(currentYear, selectedBorough);
  } else {
    graphSvg.append("text")
      .attr("x", "50%")
      .attr("y", "50%")
      .attr("text-anchor", "middle")
      .text("No data available for this attribute");
  }
}

function renderRentGraph(boroughName) {
  const rentGraphData = boroughName
    ? saveData[currentYear].boroughRentData[boroughName] || []
    : Object.values(saveData[currentYear].boroughRentData).flat();

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

  const x = d3.scaleBand()
    .domain(buckets.map(d => `$${d.x0}-${d.x1}`))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(buckets, d => d.length)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y);

  graphSvg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  graphSvg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis);

  graphSvg.selectAll(".bar")
    .data(buckets)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(`$${d.x0}-${d.x1}`))
    .attr("y", d => y(d.length))
    .attr("width", x.bandwidth())
    .attr("height", d => height - margin.bottom - y(d.length))
    .attr("fill", "#69b3a2")
    .append("title")
    .text(d => `Range: $${d.x0} - $${d.x1}\nCount: ${d.length}`);
}

function calculateOccDistribution(allUnitsData, boroughName) {
  const occCounts = {};
  allUnitsData.forEach(row => {
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
    count: value
  }));
}

function renderOCCGraph(year, boroughName) {
  const occData = calculateOccDistribution(saveData[year].allUnitsData, boroughName);
  const graphSvg = d3.select("#detail-graph svg");
  graphSvg.selectAll("*").remove(); 

  if (occData.length === 0) {
    graphSvg.append("text")
      .attr("x", "50%")
      .attr("y", "50%")
      .attr("text-anchor", "middle")
      .text("No data available");
    return;
  }

  const width = +graphSvg.style("width").replace("px", "");
  const height = +graphSvg.style("height").replace("px", "");
  const margin = { top: 20, right: 20, bottom: 60, left: 40 };

  const x = d3.scaleBand()
    .domain(occData.map(d => occLabels[d.label] || `OCC ${d.label}`))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(occData, d => d.count)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y);

  graphSvg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  graphSvg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis);

  graphSvg.selectAll(".bar")
    .data(occData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(occLabels[d.label] || `OCC ${d.label}`))
    .attr("y", d => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d => height - margin.bottom - y(d.count))
    .attr("fill", "#69b3a2")
    .append("title")
    .text(d => `${occLabels[d.label] || `OCC ${d.label}`}\nCount: ${d.count}`);
}

// Initialize graphs, for some reason I can't get the detail graph to work immediately, need to come back to that
initialize();
