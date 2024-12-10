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

const attributeLabels = {
  RENT_AMOUNT_PAID: "Average Rent",
  OCC: "Net Vacancy Rate"
};

//Global Variables
let currentAttribute = "RENT_AMOUNT_PAID"; 
let currentYear = "2021";

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

  // Add event listener to the year slider
  yearSlider.addEventListener("input", function () {
    const yearIndex = +yearSlider.value;
    currentYear = years[yearIndex].split(" ")[0];
    yearDisplay.textContent = currentYear;
    loadAndUpdateMap(currentYear);
  });

  // Add event listener for attribute changes
  d3.select("#color-attribute").on("change", function () {
    currentAttribute = d3.select(this).property("value"); //Updates global variable for attribute
    loadAndUpdateMap(currentYear); // Reload map with the current year
  });

  // Initializes map with current year
  loadAndUpdateMap(currentYear);
}

// Function to load and update the map based on the selected year
function loadAndUpdateMap(selectedYear) {
  const allUnitsPath = `/data/${selectedYear}/allunits_puf_${selectedYear.slice(-2)}.csv`;
  const occupiedPath = `/data/${selectedYear}/occupied_puf_${selectedYear.slice(-2)}.csv`;

  Promise.all([d3.csv(allUnitsPath), d3.csv(occupiedPath)]).then(([allUnitsData, occupiedData]) => {
    const rentData = mergeRentData(allUnitsData, occupiedData);
    const vacancyRateData = calculateVacancyRate(allUnitsData);

    d3.json("data/Borough Boundaries.geojson").then(geoData => {
      const mapData = {
        RENT_AMOUNT_PAID: averageRentData(rentData),
        OCC: vacancyRateData
      };

      updateMapColors(currentAttribute, mapData, geoData);
    });
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
      const isSelected = d3.select(this).classed("selected");
      svg.selectAll(".borough").classed("selected", false);
      d3.select(this).classed("selected", !isSelected);
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
function mergeRentData(allUnitsData, occupiedData) {
  const rentMap = new Map();
  occupiedData.forEach(row => { //Merges data so we can se both rent and borough at the same time
    if (row.RENTPAID_AMOUNT > 0) { 
      rentMap.set(row.CONTROL, +row.RENTPAID_AMOUNT);
    }
  });

  return allUnitsData
    .filter(row => rentMap.has(row.CONTROL))
    .map(row => ({
      boro_name: boroughMapping[row.BORO],
      rent_paid: rentMap.get(row.CONTROL)
    }));
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

initialize();
