/*jslint browser: true*/
/*jshint esnext: true*/
/*jshint sub: true*/
/*global
$, Vue, moment, Chart, L, Popper
*/

$(window).on('load', function () {
    
    // Loader
    setTimeout(function () {
        $("#loader").fadeOut(400, function(){
            $(this).remove();
        });
    }, 2500);
    $("#content, #footer").fadeTo("slow",1);
    
    // Mobile options display on load
    if($(window).width() < 992){
        $("#options, #search").addClass("fixed-top");
        $("#options").removeClass("p-3");
        $("#searchInput, #compareInput").addClass("form-control-sm");
        $("#search").find(".btn").addClass("btn-sm");
    }
    // Mobile options display on resize
    $(window).resize(function() {
        if($(window).width() <= 992){
            $("#options, #search").addClass("fixed-top");
            $("#options").removeClass("p-3");
            $("#searchInput, #compareInput").addClass("form-control-sm");
            $("#search").find(".btn").addClass("btn-sm");
        } else {
            $("#options, #search").removeClass("fixed-top");
            $("#options").addClass("p-3");
            $("#searchInput, #compareInput").removeClass("form-control-sm");
            $("#search").find(".btn").removeClass("btn-sm");
        }
    });
    
    // Remove option dropdown style
    Popper.Defaults.modifiers.computeStyle.enabled = false;

});

$(document).ready(function () {

    // Get current year for copyright
	var date = new Date();
	var year = date.getFullYear();
    document.getElementById("year").innerHTML = year;
        
    // Get REST Countries data as mixin
    Vue.mixin({
        beforeCreate: function () {
            var array = [];
            $.ajax({
                url: 'https://restcountries.com/v3.1/all',
                dataType: 'json',
                success: function (data) {
                    for(var i = 0; i < data.length; i++) {
                        array.push(data[i]);
                    }
                }
            });
            this.$allCountryData = array;
        }
    });
    
    // Create new Vue app
    var app = new Vue({
        el: '#content',
        data: () => ({
            country: {
                name: "Country",
                code: "Code",
                desc: "Enter a country name, code or capital city to display corresponding data.",
                flag: null,
                capital: "",
                region: "",
                subregion: "",
                area: "",
                borders: "",
                population: "",
                latlng: ["", ""],
                currencies: [""],
                languages: [""],
                timezones: "",
                wiki: false
            },
            map: null,
            chartPop: null,
            chartArea: null,
            compareType: "Names",
            compareValue: "",
            compareNames: [],
            comparePops: [],
            compareAreas: [],
            iterator: 0,
            utc: "",
            convertType: "",
            convertValue: "",
            searchValue: "",
            searchType: "Name",
            errors: [],
            show: 0 // 0 = none, 1 = data, 2 = map, 3 = compare
        }),
        
        watch: {
            
            // Currency conversion
            convertType: function () {
                if (this.convertType.length === 3) {
                    var codes = this.convertType + "_" + this.country.currencies[0].code;
                    var conversion = "https://free.currencyconverterapi.com/api/v6/convert?q=" + codes + "&compact=y&apiKey=5a9d8f0f18bdfd2bbadd" ;
                    $.get(conversion, function (data) {
                        var id = Object.values(data);
                        app.convertValue = "1 " + app.convertType + " = " + (id[0].val).toFixed(2) + " " + app.country.currencies[0].code;
                    });
                } else {
                    app.convertValue = "";
                }
            }
            
        },
        
        computed: {
            
            // Format coordinates
            coordinates: function () {
                var lat = Math.round(this.country.latlng[0]);
                var lng = Math.round(this.country.latlng[1]);
                if (lat >= 0) {
                    lat += "\xB0N";
                } else {
                    lat += "\xB0S";
                }
                if (lng >= 0) {
                    lng += "\xB0E";
                } else {
                    lng += "\xB0W";
                }
                return lat + " " + lng;
            },
            
            // Calculate population density
            density: function () {
                var population = this.country.population;
                var area = this.country.area;
                var density = 0;
                if (population > 0 && area > 0) {
                    density = population / area;
                    return density.toFixed(2);
                } else {
                    return "Unknown";
                }
            }

        },
        
        filters: ({
            
            // Capitilize the first letter of the string
            capitalize: function (value) {
                if (!value) {
                    return '';
                } else {
                    value = value.toString();
                    return value.replace(/\w\S*/g, function (txt) {
                        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    });
                }
            },
            
            // Format number with commas
            addCommas: function (value) {
                if (!value) {
                    return '';
                } else {
                    value = value.toString();
                    return value.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
                }
            },
            
            // Format arrays
            arrayToString: function (value) {
                var string = '';
                if (value.length === 0) {
                    string = '';
                } else {
                    for (var x = 0; x < value.length; x++) {
                        if (x === value.length - 1) {
                            string += value[x];
                        } else {
                            string += value[x] + ", ";
                        }
                    }
                }
                return string;
            },
            
            // Remove parenthesis
            removeParenthesis: function (value) {
                value = value.replace(/\s*\(.*?\)\s*/g, ' ');
                value = value.replace(/[)]/g, '');
                value = value.replace(/\s*,\D\s*/g, ", ");
                value = value.replace(/\s*;\s*/g, "; ");
                return value;
            }  
            
        }),
        
        methods: ({

            // Input validation -----------------------------------------------------------------------------------------
            validate: function (value) {
                
                // Determine if search or compare
                var type;
                if(app.show === 3){
                    type = app.compareType;
                } else {
                    type = app.searchType;
                }
                
                // Clear previous errors
                this.errors = [];
                // If input is empty
                if (!value) {
                    app.errors.push("Input is required.");
                }
                
                // If input contains a number
                if (value.match(".*\\d.*")) {
                    app.errors.push("Letters only.");
                }
                
                // If name or capital type: 4 digits min
                if (type === "Name" || type === "Capital") {
                    if (value.length < 3) {
                        app.errors.push("Country names and capital cities must be 4 or more characters.");
                    }
                }
                
                // If code type: 2 digits only
                if (type === "Code") {
                    if (value.length != 2) {
                        app.errors.push("Code must be 2 characters.");
                    }
                }
                
                // If there are no errors
                if (!this.errors.length) {
                    return true;
                }
                
                return false;
                
            },
            
            // Get data for searched country ----------------------------------------------------------------------------
            getData() {
                
                var index = 0;
                
                // BEFORE DATA FETCH: Exception handling and special cases
                var search = app.searchValue.toUpperCase();
                switch(search){
                    case "ENGLAND": case "SCOTLAND": case "WALES":
                        app.searchValue = "United Kingdom";
                        break;
                    case "SOUTH KOREA": case "KOREA":
                        app.searchValue = "Korea (Republic of)";
                        break;
                    case "NORTH KOREA":
                        app.searchValue = "Korea (Democratic People's Republic of)";
                        break;
                    case "UNITED STATES": case "UNITED":
                        app.searchValue = "United States of America";
                        break;
                    case "IVORY COAST":
                        app.searchValue = "Côte d'Ivoire";
                        break;
                    case "EAST TIMOR":
                        app.searchValue = "Timor-Leste";
                        break;
                    case "VIETNAM":
                        app.searchValue = "Viet Nam";
                        break;
                    case "LAOS":
                        app.searchValue = "Lao People's Democratic Republic";
                        break;
                    case "VATICAN": case "VATICAN CITY":
                        app.searchValue = "Holy See";
                        break;
                    case "INDIA": case "GUINEA": case "SAMOA": case "SUDAN":
                        index = 1;
                        break;
                }
                
                // Search countries for matching value and type
                var country = this.$allCountryData.filter(function(e) {
                    if(app.searchType === "Name"){
                        return (e.name.toUpperCase()).includes(app.searchValue.toUpperCase());
                    } else if(app.searchType === "Code"){
                        return (e.alpha2Code.toUpperCase()).includes(app.searchValue.toUpperCase());
                    } else if(app.searchType === "Capital"){
                        return (e.capital.toUpperCase()).includes(app.searchValue.toUpperCase());
                    }
                });

                // If no errors assign country data
                if(app.searchValue !== "" && country.length === 0){
                    app.errors.push(app.searchValue.toUpperCase() + " is not valid, please ensure spelling and search type are correct."); 
                } else {
                    app.country.name = country[index].name;
                    app.country.code = country[index].alpha2Code;
                    app.country.flag = country[index].flag;
                    app.country.capital = country[index].capital;
                    app.country.region = country[index].region;
                    app.country.subregion = country[index].subregion;
                    app.country.area = country[index].area;
                    app.country.borders = country[index].borders;
                    app.country.population = country[index].population;
                    app.country.latlng = country[index].latlng;
                    app.country.currencies = country[index].currencies;
                    app.country.languages = country[index].languages;
                    app.country.timezones = country[index].timezones;
                    app.country.wiki = "https://en.wikipedia.org/wiki/" + country[index].name;
                    app.utc = moment.utc().format('hh:mmA');
                }

                // AFTER DATA FETCH: Exception handling and special cases
                switch(app.country.name){
                    case "Bolivia (Plurinational State of)":
                        app.country.name = "Bolivia";
                        break;
                    case "Bonaire, Sint Eustatius and Saba":
                        app.country.name = "Bonaire";
                        break;
                    case "Virgin Islands (British)":
                        app.country.name = "British Virgin Islands";
                        break;
                    case "Virgin Islands (U.S.)":
                        app.country.name = "United States Virgin Islands";
                        break;
                    case "Brunei Darussalam":
                        app.country.name = "Brunei";
                        break;
                    case "Cabo Verde":
                        app.country.name = "Cape Verde";
                        break;
                    case "Congo (Democratic Republic of the)":
                        app.country.name = "Democratic Republic of the Congo";
                        break;
                    case "Congo":
                        app.country.name = "Democratic Republic of the Congo";
                        break;
                    case "Falkland Islands (Malvinas)":
                        app.country.name = "Falkland Islands";
                        break;
                    case "French Southern Territories":
                        app.country.name = "French Southern and Antarctic Lands";
                        break;
                    case "Iran (Islamic Republic of)":
                        app.country.name = "Iran";
                        break;
                    case "Lao People's Democratic Republic":
                        app.country.name = "Laos";
                        break;
                    case "Macedonia (the former Yugoslav Republic of)":
                        app.country.name = "Republic of Macedonia";
                        break;
                    case "Micronesia (Federated States of)":
                        app.country.name = "Micronesia";
                        break;
                    case "Moldova (Republic of)":
                        app.country.name = "Moldova";
                        break;
                    case "Palestine, State of":
                        app.country.name = "Palestine (region)";
                        break;
                    case "Russian Federation":
                        app.country.name = "Russia";
                        break;
                    case "Saint Martin (French part)":
                        app.country.name = "Saint Martin";
                        break;
                    case "Sint Maarten (Dutch part)":
                        app.country.name = "Sint Maarten";
                        break;
                    case "Sao Tome and Principe":
                        app.country.name = "São Tomé and Príncipe";
                        break;
                    case "Korea (Republic of)":
                        app.country.name = "South Korea";
                        break;
                    case "Korea (Democratic People's Republic of)":
                        app.country.name = "North Korea";
                        break;
                    case "Syrian Arab Republic":
                        app.country.name = "Syria";
                        break;
                    case "Tanzania, United Republic of":
                        app.country.name = "Tanzania";
                        break;
                    case "Timor-Leste":
                        app.country.name = "East Timor";
                        break;
                    case "United Kingdom of Great Britain and Northern Ireland":
                        app.country.name = "United Kingdom";
                        break;
                    case "United States of America":
                        app.country.name = "United States";
                        break;
                    case "Venezuela (Bolivarian Republic of)":
                        app.country.name = "Venezuela";
                        break;
                    case "Georgia":
                        app.country.name = "Georgia (country)";
                        break;
                    case "Macao":
                        app.country.name = "Macau";
                        break;
                    case "Viet Nam":
                        app.country.name = "Vietnam";
                        break;
                    case "Côte d'Ivoire":
                        app.country.name = "Ivory Coast";
                        break;
                    case "Gambia":
                        app.country.name = "The Gambia";
                        break;
                    case "Pitcairn":
                        app.country.name = "Pitcairn Islands";
                        break;
                    case "Republic of Kosovo":
                        app.country.name = "Kosovo";
                        break;
                }

                // GET country description from MediaWiki API
                $.ajax({
                    method: "GET",
                    url: "https://en.wikipedia.org/w/api.php",
                    data: {
                        format: "json",
                        action: "query",
                        titles: app.country.name,   // titles to search
                        prop: "extracts",           // Which properties to get for the queried pages
                        exintro: true,              // Return only content before the first section.
                        explaintext: true,          // Return extracts as plain text instead of limited HTML.
                        exsentences: 4,             // Number of sentences from extract
                        origin: '*'                 // CORS        
                    }
                })
                .done(function (response) {
                    // Each page
                    var pages = response.query.pages;
                    // Extract from pages
                    var extract = pages[Object.keys(pages)[0]].extract;
                    // If there is no extract
                    if (extract === undefined || extract === "") {
                        extract = "No description found, please see wiki for more information.";
                    }
                    // Remove the text within parenthesis
                    extract = app.$options.filters.removeParenthesis(extract);
                    // Asign extract to description
                    app.country.desc = extract;
                });
                
                // No result if errors exist
                if (app.errors.length > 1) {
                    app.show = 0;
                    return false;
                }
                
            },
            
            // Generate Maps --------------------------------------------------------------------------------------------
            getMap() {
                
                // No result if errors exist
                if (app.errors.length > 0 || app.searchValue === "") {
                    app.errors.push("Input is required.");
                    app.show = 0;
                    return false;
                }
                                
                // Clear existing maps
                if(app.map !== null){
                    app.map.off();
                    app.map.remove();
                }
                
                // Create new map
                app.map = L.map('visualMap', {
                    center: [51.505, -0.09],
                    zoom: 3
                });
                app.map.setView([app.country.latlng[0], app.country.latlng[1]], 3);

                // Create map layers
                L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(app.map);

                // Create map marker
                L.marker([app.country.latlng[0], app.country.latlng[1]]).addTo(app.map)
                    .bindPopup(app.country.name)
                .openPopup();
                
                // Adjust map to size after delay
                setTimeout(() => {
                  app.map.invalidateSize();
                }, 1500);
                
                app.show = 2;
                
            },
            
            // Search for country data  ---------------------------------------------------------------------------------
            search: function (value) {
                
                // Remove white space
                app.searchValue = app.searchValue.trim();
                                
                // If param is / is not provided
                var search = value;
                if (value === undefined) {
                    search = this.searchValue;
                } else {
                    this.searchValue = value;
                }
                
                // Get data if validation is successful
                if (app.validate(app.searchValue)) {
                    // Reset convert type
                    app.convertType = "";
                    // Get country data
                    app.getData();
                    setTimeout(function () {
                        if (app.errors.length < 1) {
                            // If map view is active, get map else show data
                            if(app.show !== 2){
                                app.show = 1;
                            } else {
                                setTimeout(function () {
                                    app.getMap();
                                },500);
                            }
                        }
                    }, 500);
                }
                
            },
            
            // Compare list of countries  -------------------------------------------------------------------------------
            compare() {
                 
                // Reset
                app.iterator = 0;
                app.compareNames = []; app.comparePops = []; app.compareAreas = [];
                                
                // Convert comma separated string to array
                var compareString = app.compareValue;
                var compareArray = compareString.split(','); 
                var country = null;
                
                // Validate list values
                var valid = false;
                for(var i = 0; i < compareArray.length; i++){
                    valid = app.validate(compareArray[i].toUpperCase().trim());
                    // Return false if invalid
                    if(valid === false){
                        return false;
                    }
                }
                
                // Destroy existing charts if new input is valid
                if((app.chartPop !== null && app.chartArea !== null)){
                    app.chartPop.destroy();
                    app.chartArea.destroy();
                }
                                
                // Create chart canvas
                var pop = document.getElementById("chartPop").getContext('2d');
                var area = document.getElementById("chartArea").getContext('2d');
                // Create population chart
                app.chartPop = new Chart(pop, {
                    type: 'bar',
                    responsive: true,
                    data: {
                        labels: app.compareNames,   
                        datasets: [{
                            label: 'Population (Bar)',
                            data: app.comparePops,
                            borderWidth: 1,
                            borderColor: "#1a1a1a",
                            hoverBackgroundColor: "rgba(0,0,0,0.5)"
                        },
                        {
                            label: 'Population (Line)',
                            data: app.comparePops,
                            type: 'line',
                            backgroundColor: "#1a1a1a",
                            borderColor: "#1a1a1a",
                            fill: "transparent"
                        }   
                    ]},
                    options:{
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero:true,
                                    callback: function(value) {
                                        return app.$options.filters.addCommas(value);
                                    }
                                }
                            }]
                        }
                    }
                });
                // Create area chart
                app.chartArea = new Chart(area, {
                    type: 'bar',
                    responsive: true,
                    data: {
                        labels: app.compareNames,   
                        datasets: [{
                            label: 'Area (Bar)',
                            data: app.compareAreas,
                            borderWidth: 1,
                            borderColor: "#1a1a1a",
                            hoverBackgroundColor: "rgba(0,0,0,0.5)"
                        },
                        {
                            label: 'Area (Line)',
                            data: app.compareAreas,
                            type: 'line',
                            backgroundColor: "#1a1a1a",
                            borderColor: "#1a1a1a",
                            fill: "transparent"
                        }
                    ]},
                    options:{
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero:true,
                                    callback: function(value) {
                                        return app.$options.filters.addCommas(value) + ' km\xB2';
                                    }
                                }
                            }]
                        }
                    }
                });
                                
                // Get data for list of countries 
                var getChartData = function(){
                    var compareVal = compareArray[app.iterator].toUpperCase().trim();
                    // Filter to see if current list value exists
                    country = app.$allCountryData.filter(function(e) {
                        if(app.compareType === "Names"){
                            return (e.name.toUpperCase()).includes(compareVal);
                        } else if(app.compareType === "Codes"){
                            return (e.alpha2Code.toUpperCase()).includes(compareVal);
                        }
                    });
                    // If it does not exist, return an error
                    if(country.length === 0) {
                        app.errors.push(compareVal + " is not valid, please ensure spelling and search type are correct.");   
                        return false;
                    }
                    // Prevent double ups
                    if((app.compareNames.indexOf(country[0].name)) !== -1){
                        return 0;
                    }
                    // push values to separate arrays
                    app.compareNames.push(country[0].name);
                    app.comparePops.push(country[0].population);
                    app.compareAreas.push(country[0].area);
                };
                
                // While the iterator is less than the compare array continue to get data
                while(app.iterator < compareArray.length){
                    // If there are no errors update
                    if(getChartData() !== false){
                        app.chartPop.update();
                        app.chartArea.update();
                        $("#compare").find(".desc").css( "display", "inline" );
                    }
                    app.iterator = app.iterator + 1;
                }
                
            },
            
            // Display random country  ----------------------------------------------------------------------------------
            random() {
                
                // Get country names
                var rand = Math.floor((Math.random() * this.$allCountryData.length - 1) + 1);
                var randomCountry = this.$allCountryData[rand].name;
                app.searchType = "Name";
                app.search(randomCountry);
                
            },
            
            // Clear all data and input ---------------------------------------------------------------------------------
            clear() {
                
                // Remove map if it exists
                if(app.map !== null){
                    app.map.off();
                    app.map.remove();
                }
                
                // Destroy charts if they exist
                if(app.chartPop !== null){
                    $("#compare").find(".desc").css( "display", "none" );
                    app.chartPop.destroy();
                    app.chartArea.destroy();
                }
                
                // Save current show value
                var currentShow = app.show;
                
                // Clear all data by creating original Vue object
                Object.assign(this.$data, this.$options.data());
                
                // Display appropriate view after clear
                if(currentShow < 3){
                    app.show = 0;
                } else {
                    app.show = 3;   
                }
                
            }
            
        })
    });
    
    // Expand / Collapse for charts
    $(".expand").on("click", function(){
        var div = $(this).closest('div');
        $(this).toggleClass("fa-expand fa-compress");
        if(div.hasClass("col-12")) {
            setTimeout(function(){
                div.siblings().toggleClass("d-none");
            },350);
        }
        else {
            div.siblings().toggleClass("d-none");
        }
        div.toggleClass("col-lg-6 col-12 px-3");
    });
    
});