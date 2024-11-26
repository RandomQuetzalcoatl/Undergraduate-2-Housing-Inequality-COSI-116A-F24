const width = "100%";
const height = "100%";

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

const yearSlider = document.getElementById("year-slider");
const yearDisplay = document.getElementById("year-display");

yearSlider.addEventListener("input", function() {
  const yearIndex = +yearSlider.value;
  yearDisplay.textContent = years[yearIndex].split(" ")[0];
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

d3.json("Borough Boundaries.geojson").then(data => {
  const boroughs = svg.selectAll("path")
    .data(data.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "borough")
    .append("title")
    .text(d => `${d.properties.boro_name}\nAverage Rent: 1544`); //temporary tooltip

  function updateMapColors(attribute) {
    const maxValue = d3.max(data.features, d => +d.properties[attribute]);
    const colorScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range(["#ffcccc", "#ff0000"]);

    document.getElementById("legend-min").textContent = "0%";
    document.getElementById("legend-max").textContent = "100%";

    svg.selectAll(".borough")
      .attr("fill", d => colorScale(+d.properties[attribute]))
      .on("mouseover", function(event, d) {
        d3.select(this).style("fill", "orange");
      })
      .on("mouseout", function(event, d) {
        d3.select(this).style("fill", colorScale(+d.properties[attribute]));
      })
      .on("click", function(event, d) {
        const isSelected = d3.select(this).classed("selected");
        svg.selectAll(".borough").classed("selected", false);
        d3.select(this).classed("selected", !isSelected);
      });
  }

  updateMapColors("shape_area");

  d3.select("#color-attribute").on("change", function() {
    const selectedAttribute = d3.select(this).property("value");
    updateMapColors(selectedAttribute);
  });
}).catch(error => console.error("Error loading GeoJSON:", error));
