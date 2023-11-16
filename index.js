'use strict';

/** @enum {number} */
const readoutUnits = {
  mph: 2.23694,
  kmh: 3.6
};

/** @const */
const appOpts = {
  dom: {
    body: document.querySelector('body'),
    start: document.querySelector('#start'),
    readout: document.querySelector('#readout'),
  },

  readoutUnit: readoutUnits.kmh,
  watchId: null,
  wakeLock: null
};

document.querySelector('#start').addEventListener('click', (event) => {
  if (appOpts.watchId) {
    navigator.geolocation.clearWatch(appOpts.watchId);

    if (appOpts.wakeLock) {
      appOpts.wakeLock.cancel();
    }

    appOpts.watchId = null;
    appOpts.dom.start.textContent = '🔑 Start';
    appOpts.dom.start.classList.toggle('selected');

      // Clear the displayed values
      const speedParagraph = document.getElementById("currentspeed");
      speedParagraph.textContent = "0 km/h";
      const locationParagraph = document.getElementById("location");
      locationParagraph.textContent = "Fetching...";
      const radiusParagraph = document.getElementById("radius");
      radiusParagraph.textContent = "N/A";
      const safeSpeedParagraph = document.getElementById("safespeed");
      safeSpeedParagraph.textContent = "N/A";
      const designSpeedParagraph = document.getElementById("designspeed");
      designSpeedParagraph.textContent = "N/A";
      const warningParagraph = document.getElementById("warning");
      warningParagraph.textContent = "";

      
  } else {
    const options = {
      enableHighAccuracy: true
    };
    appOpts.watchId = navigator.geolocation.watchPosition(parsePosition, null, options);
    startWakeLock();

    appOpts.dom.start.textContent = '🛑 Stop';
    appOpts.dom.start.classList.toggle('selected');
  }
});

const startAmbientSensor = () => {
  if ('AmbientLightSensor' in window) {
    navigator.permissions.query({ name: 'ambient-light-sensor' })
      .then(result => {
        if (result.state === 'denied') {
          return;
        }
        const sensor = new AmbientLightSensor({frequency: 0.25});
        sensor.addEventListener('reading', () => {
          if (sensor['illuminance'] < 3 && !appOpts.dom.body.classList.contains('dark')) {
            appOpts.dom.body.classList.toggle('dark');
          } else if (sensor['illuminance'] > 3 && appOpts.dom.body.classList.contains('dark')) {
            appOpts.dom.body.classList.toggle('dark');
          };
        });
        sensor.start();
    });
  }
}

const startWakeLock = () => {
  try {
    navigator.getWakeLock("screen").then((wakeLock) => {
      appOpts.wakeLock = wakeLock.createRequest();
    });
  } catch(error) {
    // no experimental wake lock api build
  }
}

function parsePosition(position) {
  const speedInKmh = position.coords.speed * readoutUnits.kmh;

  const speedParagraph = document.getElementById("currentspeed");
  speedParagraph.textContent = `${Math.round(speedInKmh)} km/h`;

  const locationParagraph = document.getElementById("location");  
  locationParagraph.textContent = `Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`;

  // Fetch the database
  fetch('database.json')
    .then(response => response.json())
    .then(data => {
      let closestEntry = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      data.forEach(entry => {
        const entryLatitude = entry.latitude;
        const entryLongitude = entry.longitude;

        const distance = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          entryLatitude,
          entryLongitude
        );

        if (distance < closestDistance) {
          closestEntry = entry;
          closestDistance = distance;
        }
      });

      if (closestEntry) {
        const radiusParagraph = document.getElementById("radius");
        const safeSpeedParagraph = document.getElementById("safespeed");
        const designSpeedParagraph = document.getElementById("designspeed");
        const warningParagraph = document.getElementById("warning");

        if (closestDistance <= 0.11) { // We are considering only if there's a location within 0.11km whose radius is stored
          // Update radius and safety information
          radiusParagraph.textContent = `Radius: ${closestEntry.radius || 'N/A'}`;

          if (closestEntry.radius !== undefined) {
            // const safeSpeed = (88.87 - (2554.76 / closestEntry.radius)) * (0.278) * (18/5);
            const safeSpeed = Math.sqrt((0.22) * 9.8 * closestEntry.radius) * (18/5);
            safeSpeedParagraph.textContent = `Safe Speed: ${Math.round(safeSpeed)} km/h`;

            const designSpeed = Math.sqrt((0.22) * 9.8 * closestEntry.radius) * (18/5);
            designSpeedParagraph.textContent = `Design Speed: ${Math.round(designSpeed)} km/h`;

            if (safeSpeed < speedInKmh || designSpeed < speedInKmh) {
              warningParagraph.textContent = "Warning: Speed Limit Exceeded!";
            } else {
              warningParagraph.textContent = "";
            }
          } else {
            safeSpeedParagraph.textContent = `Safe Speed: N/A`;
            designSpeedParagraph.textContent = `Design Speed: N/A`;
            warningParagraph.textContent = "";
          }
        } else {
          // Distance greater than 1 km, set radius as N/A
          radiusParagraph.textContent = `Radius: N/A`;
        }
      }
    })
    .catch(error => {
      console.error('Error loading the database:', error);
    });
}

// Function to calculate the distance between two sets of coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371; // Radius of the Earth in kilometers

  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

const startServiceWorker = () => {
  navigator.serviceWorker.register('service-worker.js', {
    scope: './'
  });
}

startAmbientSensor();
startServiceWorker();
