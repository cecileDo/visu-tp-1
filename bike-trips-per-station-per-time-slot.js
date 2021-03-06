// Visualisation des données TP1
//
//     Los Angeles Metro Share Bike Trips data
//
// Using:
// Bootstrap slider widget: https://seiyria.com/bootstrap-slider/

var debug = false;
var weekend = false;
var timeSlot = 16;

// Découpage de la journée en interval de temps de 30 minutes
const SLOT_DURATION   = 30;
const SLOTS_PER_HOUR  = Math.floor(60 / SLOT_DURATION);
const SLOTS_PER_DAY   = 24 * SLOTS_PER_HOUR;

var slotsLabels = [];         // Label pour chaque interval de temps (ex: 13:30)

var weekdayStationsData = []; // Nombres de voyages par station par interval de temps (lundi-vendredi)
var weekendStationsData = []; // Nombres de voyages par station par interval de temps (samedi-dimanche)

// Index des différentes données dans les entrées du tableau stationsData
const ID_IDX          = 0;
const LAT_IDX         = 1;
const LONG_IDX        = 2;
const START_SLOTS_IDX = 3;
const END_SLOTS_IDX   = SLOTS_PER_DAY + START_SLOTS_IDX;

// Parse l'objet .csv chargé et construit un tableau de données qui sera
// exploité pour dessiner les graphiques.
function parseCsvData(csv, stationsData) {

    csv.forEach(function(x) {
        // lecture de chaque ligne du csv dans un tableau ajouté dans notre table globale
        var i;
        station = [x.station_id,
                   parseFloat(x.station_lat),
                   parseFloat(x.station_long)];
        for (i=0; i < SLOTS_PER_DAY; i++) {
            station.push(x["start_slot_" + i])
        }
        for (i=0; i < SLOTS_PER_DAY; i++) {
            station.push(x["end_slot_" + i])
        }
        stationsData.push(station);
        if (debug) {
            console.log(station);
        }
    });
    console.log("" + stationsData.length + " entries parsed");
}

// Fonction appelée quand le .csv contenant les données des jours de semaine a été lu
function weekdayStationsDataReady(error, csv) {

    console.log("Finished reading weekday data csv");

    if (error) throw error;

    parseCsvData(csv, weekdayStationsData);
    drawStations(weekdayStationsData);
    console.log("data length: " + weekdayStationsData.length);

    d3.csv("data/trips_per_station_per_time_slot_weekend.csv", weekendStationsDataReady);
}

// Fonction appelée quand le .csv contenant les données des jours de weekend a été lu
function weekendStationsDataReady(error, csv) {

    console.log("Finished reading weekend data csv");

    if (error) throw error;

    parseCsvData(csv, weekendStationsData);
}

// Fonction dessinant les stations sur la carte
function drawStations(stationsData) {

    console.log("Starting chart drawing: " + stationsData.length + " entries");

    var minArc = 15;
    var maxArc = 50;
    var mapWidth   = 950;
    var mapHeight  = 1103;
    var mapPadding = minArc;

    // Determine les minimum/maximum pour la latitude et la longitude des stations
    var minLat = d3.min(stationsData, function(x) { return x[LAT_IDX]; });
    var maxLat = d3.max(stationsData, function(x) { return x[LAT_IDX]; });
    var minLong = d3.min(stationsData, function(x) { return x[LONG_IDX]; });
    var maxLong = d3.max(stationsData, function(x) { return x[LONG_IDX]; });
    var centerLat = minLat + ((maxLat - minLat) / 2);
    var centerLong = minLong + ((maxLong - minLong) / 2);

    // Adjust height
    //mapHeight = Math.floor((mapWidth * Math.abs(maxLat - minLat)) / Math.abs(maxLong - minLong));

    // Determine le nombre maximum de voyages enregistrés pour un time slot
    var maxTrips = d3.max(stationsData, function(x) {
        return x.slice(START_SLOTS_IDX, END_SLOTS_IDX + SLOTS_PER_DAY)
            .reduce(function(a, b) { return Math.max(a, b); });
    });

    if (true || debug) {
        console.log(`Latitude: min=${minLat} max=${maxLat} center=${centerLat} mapWidth=${mapWidth}`);
        console.log(`Longitude: min=${minLong} max=${maxLong} center=${centerLong} mapHeight=${mapHeight}`);
        console.log(`Trip count: max=${maxTrips}`);
    }

    // Calcul les echelles en fonction des données
    var scaleX = d3.scale.linear().domain([minLong, maxLong]).range([0+mapPadding, mapWidth-mapPadding]);
    var scaleY = d3.scale.linear().domain([minLat, maxLat]).range([mapHeight-mapPadding, 0+mapPadding]);
    var scaleTripCount = d3.scale.linear().domain([0, maxTrips]).range([0, maxArc]);

    // Ajout d'un div pour le tooltip
    var tooltip = d3.select("tab_contains_space").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Fonction pour dessiner l'arc représentant les départs
    var drawStartArc = d3.svg.arc()
        .innerRadius(minArc)
        .outerRadius(function(d, i) {
            return minArc + scaleTripCount(d[START_SLOTS_IDX + timeSlot]);
        })
        .startAngle(0 * (Math.PI/180))
        .endAngle(180 * (Math.PI/180));

    // Fonction pour dessiner l'arc représentant les arrivées
    var drawEndArc = d3.svg.arc()
        .innerRadius(minArc)
        .outerRadius(function(d, i) {
            return minArc + scaleTripCount(d[END_SLOTS_IDX + timeSlot]);
        })
        .startAngle(0 * (Math.PI/180))
        .endAngle(-180 * (Math.PI/180));

    // Creer le graphe
    var chart = d3.select("#svgchartmap")
        .attr("width", mapWidth)
        .attr("height", mapHeight);

    // Ajout de la carte dans le fond
    chart.append("defs")
        .append("pattern")
            .attr("id", "bgimagela")
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', mapWidth )
            .attr('height',mapHeight)
        .append("image")
            .attr("xlink:href", "images/los-angeles-map.png")
            .attr('width', mapWidth )
            .attr('height', mapHeight);
    chart.append("rect")
        .attr("width", mapWidth)
        .attr("height", mapHeight)
        .attr("fill", "url(#bgimagela)");

    // Ajoute autant d'élément g que de lignes de données
    // et positione les éléments
    var oneStation = chart.selectAll("g")
        .data(stationsData)
        .enter().append("g")
        .attr("transform", function(d, i) {
            var x = scaleX(d[LONG_IDX]);
            var y = scaleY(d[LAT_IDX]);
            return `translate(${x}, ${y})`;
        });

    // Pour chaque element g: ajoute un element cercle
    oneStation.append("circle")
        .attr("r", minArc)
        .attr("stroke-fill", "black")
        .attr("stroke-width", 3)
        .attr("fill", "#a0d53f")
        .attr("fill-opacity", 0.6)
        .on("mouseover", function(d, i) {
            d3.select(this)
                .attr("fill", "#ccfb76");
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            tooltip.html("<strong>Station " + d[ID_IDX] + "</strong></br>" +
                         "Départs: " + d[START_SLOTS_IDX  + timeSlot] + "</br>" +
                         "Arrivées: " + d[END_SLOTS_IDX  + timeSlot])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
            })
        .on("mouseout", function(d) {
            d3.select(this)
                .attr("fill", "#a0d53f");
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Dessine l'arc représentant le nombre de départs de la station
    oneStation.append("path")
        .style("fill", "green")
        .attr("fill-opacity", 0.6)
        .attr("d", drawStartArc);

    // Dessine l'arc représentant le nombre d'arrivées à la station
    oneStation.append("path")
        .style("fill", "red")
        .attr("fill-opacity", 0.6)
        .attr("d", drawEndArc);

    // Ajoute le numero de la station
    oneStation.append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return "" + d[0]; });

    // Ajoute l'interval de temps
    chart.append("text")
        .attr("x", 50)
        .attr("y", 50)
        .attr("text-anchor", "left")
        .attr("fill-opacity", 0.7)
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .text(function(d) { return slotsLabels[timeSlot];});

    console.log("Chart drawn !");
} // drawStations()

// Initialise une table contenant les labels des intervals de temps: ex. "13:30-14:00"
function initTimeSlotsLabels() {

    var slotLabel = function(s) {
        var hours = Math.floor(s / SLOTS_PER_HOUR);
        var minutes = (s % SLOTS_PER_HOUR) * SLOT_DURATION;
        return ("00" + hours).substr(-2) + ":" + ("00" + minutes).substr(-2);
    };

    for (slot = 0; slot < SLOTS_PER_DAY; slot++) {
        slotsLabels[slot] = slotLabel(slot) + "-" + slotLabel((slot + 1) % SLOTS_PER_DAY);
    }
    if (debug)
        console.log("Time slots labels: " + slotsLabels);
}

//
// Main
//

initTimeSlotsLabels();

// Chargement du fichier .csv contenant les données des jours de semaine
// Attention: operation asynchrone! Le reste du code doit être dans la routine callback.
d3.csv("data/trips_per_station_per_time_slot_weekday.csv", weekdayStationsDataReady);

// Le slider pour changer l'interval de temps
$('#timeSlider').slider({
    formatter: function(value) {
        return slotsLabels[value];
    }
});

$("#timeSlider").on("slide", function(slideEvt) {
    timeSlot = slideEvt.value;
    $("#timeSliderVal").text(slotsLabels[timeSlot]);
    // Re-dessiner le graphique pour le nouvel interval
    d3.select("#svgchartmap").selectAll("*").remove();
    if (weekend) {
        drawStations(weekendStationsData);
    } else {
        drawStations(weekdayStationsData);
    }
});

//
// Appelé quand les boutons semaine/weekend sont cliqués
//
$('#weekday_button').click(function() {
    //$(this).addClass('active').siblings().removeClass('active');
    console.log("Weekday!");
    if (weekend) {
        weekend = false;
        d3.select("#svgchartmap").selectAll("*").remove();
        drawStations(weekdayStationsData);
    }
});

$('#weekend_button').click(function() {
    console.log("Weekend!");
    if (!weekend) {
        weekend = true;
        d3.select("#svgchartmap").selectAll("*").remove();
        drawStations(weekendStationsData);
    }
});
