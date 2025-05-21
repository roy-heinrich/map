// Your Mapbox access token
const mapboxAccessToken = 'pk.eyJ1Ijoicm95LWhlaW5yaWNoIiwiYSI6ImNtYXdrNXRwcTBienQyc3IydzNtcHI3NW8ifQ.H1_Rl1ftMSa3jXsDcEWFTQ'; // Replace with your actual token

// Initialize the map centered on a default location (adjust as needed)
// We'll set the view later once we have user's location or target.
const map = L.map('map');

// Add Mapbox tile layer (replacing OpenStreetMap)
// Add Mapbox tile layer with custom style
L.mapboxGL({
    accessToken: mapboxAccessToken,
    style: 'mapbox://styles/roy-heinrich/cmaxzthoa002k01rk4peh94se' // Your custom style
}).addTo(map);

// Variables to store markers and route
let startMarker = null; // User's location
let endMarker = null;   // Target location
let routeLayer = null;

// DOM elements
const distanceElement = document.getElementById('distance');
const durationElement = document.getElementById('duration');
const directionSteps = document.getElementById('direction-steps');
const userLocationStatus = document.getElementById('user-location-status');

// Default end location coordinates (target)
const defaultEndLat = 11.609512;
const defaultEndLng = 122.489644;

// Function to create a marker (markers will not be draggable by default)
function createMarker(latlng, isStart) {
    const markerColor = isStart ? 'green' : 'red'; // Green for user, Red for target
    const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    return L.marker(latlng, { icon: markerIcon, draggable: false }).addTo(map); // draggable: false
}

// Initialize the target (end) marker
function initializeTargetLocation() {
    const targetLatLng = L.latLng(defaultEndLat, defaultEndLng);
    if (endMarker) {
        map.removeLayer(endMarker);
    }
    endMarker = createMarker(targetLatLng, false); // false indicates it's the end/target marker
    
    // Center map on target initially, or wait for user location
    map.setView(targetLatLng, 13); 
}

// Add a button to request location
function addLocationButton() {
    // Create a custom button
    const locationButton = L.control({position: 'topleft'});
    
    locationButton.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'location-button');
        div.innerHTML = '<button style="padding: 10px; background-color: white; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">📍 Get My Location</button>';
        div.style.backgroundColor = 'white';
        div.style.padding = '5px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
        
        div.onclick = function() {
            userLocationStatus.textContent = 'Requesting your location...';
            getUserLocation();
        };
        
        return div;
    };
    
    locationButton.addTo(map);
}

// Call these functions when the script loads
initializeTargetLocation();
addLocationButton(); // Add the location button instead of automatically requesting location
// getUserLocation(); // Comment out the automatic location request

// Get User's Current Location
function getUserLocation() {
    if (navigator.geolocation) {
        userLocationStatus.textContent = 'Detecting your location...';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const userLatLng = L.latLng(userLat, userLng);

                userLocationStatus.textContent = 'Location found!';
                
                if (startMarker) {
                    map.removeLayer(startMarker);
                }
                startMarker = createMarker(userLatLng, true); // true indicates it's the start/user marker
                // startInput.value = `${userLatLng.lat.toFixed(6)}, ${userLatLng.lng.toFixed(6)}`; // Input field removed

                // If target marker is also set, get the route
                if (endMarker) {
                    getRoute();
                }
            },
            (error) => {
                console.error("Error getting user location:", error);
                let errorMsg = "Unknown error";
                
                // Provide better error messages based on error code
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = "Permission denied";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = "Position unavailable";
                        break;
                    case error.TIMEOUT:
                        errorMsg = "Request timed out";
                        break;
                }
                
                userLocationStatus.textContent = `Error: ${errorMsg}. Please enable location services.`;
                
                // Optionally, still show map centered on target or a default view
                if (!map.getCenter()) { // If map view not set
                    map.setView([defaultEndLat, defaultEndLng], 7); // Fallback view
                }
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    } else {
        userLocationStatus.textContent = "Geolocation is not supported by this browser.";
        if (!map.getCenter()) {
            map.setView([defaultEndLat, defaultEndLng], 7); // Fallback view
        }
    }
}


// Removed event listeners for buttons and map clicks for setting points

// Function to get route using Mapbox Directions API instead of Valhalla
async function getRoute() {
    if (!startMarker || !endMarker) {
        console.warn('Attempted to get route without start or end marker.');
        return;
    }
    
    userLocationStatus.textContent = 'Calculating route...';
    // Clear previous route
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    // Clear previous directions
    directionSteps.innerHTML = '';
    
    try {
        const startCoords = `${startMarker.getLatLng().lng},${startMarker.getLatLng().lat}`;
        const endCoords = `${endMarker.getLatLng().lng},${endMarker.getLatLng().lat}`;
        
        // Mapbox Directions API endpoint
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${startCoords};${endCoords}`;
        
        const response = await fetch(`${directionsUrl}?alternatives=false&geometries=geojson&steps=true&access_token=${mapboxAccessToken}`);
        
        console.log('Mapbox Response Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Mapbox API Error:', response.status, response.statusText, errorText);
            userLocationStatus.textContent = `Error fetching route: ${response.statusText}.`;
            return;
        }
        
        const data = await response.json();
        console.log('Mapbox Response Data:', data);
        
        if (data.routes && data.routes.length > 0) {
            userLocationStatus.textContent = 'Route found!';
            const route = data.routes[0];
            
            // Display route on map
            const routeCoordinates = [];
            
            // Mapbox returns coordinates as [lng, lat], but Leaflet needs [lat, lng]
            route.geometry.coordinates.forEach(coord => {
                routeCoordinates.push([coord[1], coord[0]]);
            });
            
            routeLayer = L.polyline(routeCoordinates, {
                color: 'blue',
                weight: 5,
                opacity: 0.7
            }).addTo(map);
            
            // Fit map to show the entire route
            map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
            
            // Display route information
            const distance = (route.distance / 1000).toFixed(2); // Convert meters to kilometers
            const duration = formatDuration(route.duration); // Duration is in seconds
            
            distanceElement.textContent = `Distance: ${distance} km`;
            durationElement.textContent = `Estimated Time: ${duration}`;
            
            // Display turn-by-turn directions
            if (route.legs && route.legs.length > 0) {
                route.legs[0].steps.forEach((step, index) => {
                    const li = document.createElement('li');
                    // Remove HTML tags from instructions if present
                    const instruction = step.maneuver.instruction.replace(/<[^>]*>/g, '');
                    li.textContent = instruction;
                    directionSteps.appendChild(li);
                });
            }
        } else {
            console.error('No routes found in Mapbox response:', data);
            userLocationStatus.textContent = 'Could not find a route.';
            if (data.message) {
                userLocationStatus.textContent += ` (Error: ${data.message})`;
            }
        }
    } catch (error) {
        console.error('Error fetching route (catch block):', error);
        userLocationStatus.textContent = 'Error fetching route. Check connection.';
    }
}

// Function to format duration in seconds to a readable format
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours} hr ${minutes} min`;
    } else {
        return `${minutes} min`;
    }
}

// Handle marker drag events to update coordinates and route
// This function might not be needed if markers are not draggable.
// If you keep it, ensure it's only called if markers are made draggable again.
/*
function setupMarkerDragEvents(marker, input, isStart) {
    marker.on('dragend', function() {
        const latlng = marker.getLatLng();
        // input.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`; // Input fields removed
        
        if (startMarker && endMarker) {
            getRoute();
        }
    });
}
*/

// Removed map.on('click') event listener for adding markers directly
map.on('click', function(e) {
    // If no start marker exists, create it
    if (!startMarker) {
        startMarker = createMarker(e.latlng, true);
        startInput.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        setupMarkerDragEvents(startMarker, startInput, true);
    }
    // If start exists but no end marker, create end marker
    else if (!endMarker) {
        endMarker = createMarker(e.latlng, false);
        endInput.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        setupMarkerDragEvents(endMarker, endInput, false);
        
        // Get route once both markers are set
        getRoute();
    }
});

// Add this after your map is initialized
const buildingData = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "name": "Tomas SM. Bautista Elementary School"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        // Replace with actual building outline coordinates
                        [122.489344, 11.609312],
                        [122.489944, 11.609312],
                        [122.489944, 11.609712],
                        [122.489344, 11.609712],
                        [122.489344, 11.609312]
                    ]
                ]
            }
        }
    ]
};

L.geoJSON(buildingData, {
    style: {
        color: "#ff7800",
        weight: 2,
        opacity: 0.65
    },
    onEachFeature: function(feature, layer) {
        if (feature.properties && feature.properties.name) {
            layer.bindTooltip(feature.properties.name, {
                permanent: true,
                direction: "center",
                className: "building-label-tooltip"
            });
        }
    }
}).addTo(map);
