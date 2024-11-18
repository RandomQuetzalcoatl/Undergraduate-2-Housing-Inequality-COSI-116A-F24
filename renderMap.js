const width = "100%";
const height = "100%";

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
  svg.selectAll("path")
    .data(data.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "borough")
    .on("mouseover", function(event, d) {
      d3.select(this).style("fill", "orange");
    })
    .on("mouseout", function(event, d) {
      d3.select(this).style("fill", "");
    })
    .append("title")
    .text(d => d.properties.boro_name);
}).catch(error => console.error("Error loading GeoJSON:", error));
