// Weather Felt - JavaScript
// Weather data changes the page colours, text, and animated particles

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

// Store the main settings and API data in one place.
const state = {
  place: {
    name: "Toronto",
    region: "Ontario, Canada",
    latitude: 43.6532,
    longitude: -79.3832,
  },
  unit: "c",
  data: null,
  selectedIndex: 0, // The forecast hour currently shown
  startIndex: 0,    // The starting hour for the 12-hour timeline
  paused: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  particles: [],
  raf: null, // requestAnimationFrame ID for the Canvas animation, made null when paused or to prevent duplicate calls/loops
};

// Connect JavaScript to the elements in index.html.
const elements = {
  body: document.body,
  placeName: document.querySelector("#place-name"),
  placeMeta: document.querySelector("#place-meta"),
  temperature: document.querySelector("#temperature"),
  condition: document.querySelector("#condition"),
  poem: document.querySelector("#weather-poem"),
  feelsLike: document.querySelector("#feels-like"),
  windSpeed: document.querySelector("#wind-speed"),
  humidity: document.querySelector("#humidity"),
  cloudCover: document.querySelector("#cloud-cover"),
  updated: document.querySelector("#last-updated"),
  cityForm: document.querySelector("#city-form"),
  cityInput: document.querySelector("#city-input"),
  searchStatus: document.querySelector("#search-status"),
  timeline: document.querySelector("#timeline"),
  unitToggle: document.querySelector("#unit-toggle"),
  motionToggle: document.querySelector("#motion-toggle"),
  dataToggle: document.querySelector("#data-toggle"),
  jsonPanel: document.querySelector("#json-panel"),
  jsonOutput: document.querySelector("#json-output"),
  canvas: document.querySelector("#weather-canvas"),
};

// These labels come from Open-Meteo weather codes.
const weatherLabels = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

// Four colours for different weather conditions (sky top, middle, bottom, accent).
const palettes = {
  coldDay: ["#152642", "#4d7292", "#c5dae4", "#d9f0ff"],
  mildDay: ["#172444", "#607da1", "#e1ad88", "#ffe0a4"],
  warmDay: ["#352348", "#a45f68", "#e58f6f", "#ffd18e"],
  cloudyDay: ["#20293a", "#596477", "#9ba4ad", "#dae0e4"],
  rainDay: ["#0b1727", "#263b52", "#53697a", "#9bb2c0"],
  snowDay: ["#24324d", "#66819e", "#c6d8e8", "#f4f8ff"],
  clearNight: ["#050713", "#121b3c", "#293657", "#d8e0ff"],
  cloudNight: ["#080b14", "#1b2536", "#3f4c5e", "#aeb8c8"],
  stormNight: ["#03050a", "#101828", "#273346", "#99aac4"],
};

// Short descriptions that make the weather feel more atmospheric.
const poems = {
  clear: [
    "Light reaches the ground without interruption.",
    "The sky opens wide above the city.",
    "A clear horizon makes distance feel closer.",
  ],
  cloud: [
    "Clouds soften the edges of the day.",
    "The light arrives filtered and quiet.",
    "A moving ceiling gathers over the city.",
  ],
  rain: [
    "Rain redraws the city in vertical lines.",
    "The air darkens as water begins to move.",
    "Every surface catches a different rhythm.",
  ],
  snow: [
    "Snow slows the distance between sky and ground.",
    "Cold air turns motion into soft fragments.",
    "The city grows quieter with every falling piece.",
  ],
  fog: [
    "The horizon moves closer and the world loses depth.",
    "Fog edits the city down to its nearest shapes.",
    "Distance dissolves into a pale atmosphere.",
  ],
  storm: [
    "Pressure gathers in the darkest part of the sky.",
    "The atmosphere tightens before it breaks.",
    "Light and sound wait inside the cloud layer.",
  ],
};

// Weather helpers

function formatTemperature(value) {
  if (state.unit === "f") value = value * 9 / 5 + 32;
  return `${Math.round(value)}°`;
}

function kindFromCode(code) {
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 1 && code <= 3) return "cloud";
  return "clear";
}

function choosePalette(point) {
  const kind = kindFromCode(point.weather_code);

  if (point.is_day === 0) {
    if (kind === "rain" || kind === "storm") return palettes.stormNight;
    if (kind === "cloud" || kind === "fog" || kind === "snow") return palettes.cloudNight;
    return palettes.clearNight;
  }

  if (kind === "rain" || kind === "storm" || kind === "fog") return palettes.rainDay;
  if (kind === "snow") return palettes.snowDay;
  if (kind === "cloud") return palettes.cloudyDay;
  if (point.temperature_2m <= 4) return palettes.coldDay;
  if (point.temperature_2m >= 24) return palettes.warmDay;

  return palettes.mildDay;
}

function sentenceFor(point) {
  const options = poems[kindFromCode(point.weather_code)];
  const number = Math.abs(Math.round(
    point.temperature_2m + point.wind_speed_10m + point.cloud_cover
  ));

  return options[number % options.length];
}

// Each hourly weather property is an array. This combines the same hour from each array.
function currentPoint() {
  if (!state.data) return null;

  const hourly = state.data.hourly;
  const i = state.selectedIndex;

  return {
    time: hourly.time[i],
    temperature_2m: hourly.temperature_2m[i],
    apparent_temperature: hourly.apparent_temperature[i],
    relative_humidity_2m: hourly.relative_humidity_2m[i],
    precipitation: hourly.precipitation[i],
    weather_code: hourly.weather_code[i],
    cloud_cover: hourly.cloud_cover[i],
    wind_speed_10m: hourly.wind_speed_10m[i],
    wind_direction_10m: hourly.wind_direction_10m[i],
    is_day: hourly.is_day[i],
  };
}

function updateJson() {
  if (!state.data) return;

  elements.jsonOutput.textContent = JSON.stringify({
    location: state.place,
    timezone: state.data.timezone,
    current: state.data.current,
    selected_hour: currentPoint(),
    units: state.data.hourly_units,
  }, null, 2);
}

// Updating the website 

function updateScene() {
  const point = currentPoint();
  if (!point) return;

  // Let CSS use the colours and light position for the selected forecast hour.
  const colours = choosePalette(point);
  const hour = Number(point.time.slice(11, 13));
  const progress = Math.max(0.08, Math.min(0.92, (hour - 5) / 15));
  const root = document.documentElement;

  root.style.setProperty("--sky-top", colours[0]);
  root.style.setProperty("--sky-mid", colours[1]);
  root.style.setProperty("--sky-bottom", colours[2]);
  root.style.setProperty("--accent", colours[3]);
  root.style.setProperty("--celestial-x", `${12 + progress * 74}%`);
  root.style.setProperty("--celestial-y", `${36 - Math.sin(progress * Math.PI) * 23}%`);

  elements.body.classList.toggle("night", point.is_day === 0);

  // Update the weather numbers and description on the page.
  elements.temperature.textContent = formatTemperature(point.temperature_2m);
  elements.condition.textContent = weatherLabels[point.weather_code] || "Changing conditions";
  elements.poem.textContent = sentenceFor(point);
  elements.feelsLike.textContent = formatTemperature(point.apparent_temperature);
  elements.windSpeed.textContent = Math.round(point.wind_speed_10m);
  elements.humidity.textContent = Math.round(point.relative_humidity_2m);
  elements.cloudCover.textContent = Math.round(point.cloud_cover);

  // Show which forecast card is selected.
  document.querySelectorAll(".hour-card").forEach((card) => {
    const selected = Number(card.dataset.hourIndex) === state.selectedIndex;
    card.classList.toggle("active", selected);
    card.setAttribute("aria-pressed", String(selected));
  });

  updateJson();
  resetParticles(point);
}

function renderTimeline() {
  if (!state.data) return;

  elements.timeline.replaceChildren();
  const hourly = state.data.hourly;
  const end = Math.min(state.startIndex + 12, hourly.time.length);

  for (let i = state.startIndex; i < end; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hour-card";
    button.dataset.hourIndex = i;

    const hour = Number(hourly.time[i].slice(11, 13)); 
    const hourLabel = i === state.startIndex
      ? "Now"
      : `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;

    button.innerHTML = `
      <span>${hourLabel}</span>
      <strong>${formatTemperature(hourly.temperature_2m[i])}</strong>
      <small>${weatherLabels[hourly.weather_code[i]] || "Changing"}</small>
    `;

    button.addEventListener("click", () => {
      state.selectedIndex = i;
      updateScene();
    });

    elements.timeline.append(button);
  }
}

function markActivePreset() {
  document.querySelectorAll(".presets button").forEach((button) => {
    button.classList.toggle("active", button.dataset.city === state.place.name);
  });
}

// Getting the live weather data

function makeRequestUrl() {
  const params = new URLSearchParams({
    latitude: state.place.latitude,
    longitude: state.place.longitude,
    hourly: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day",
    current: "temperature_2m,weather_code,is_day",
    forecast_days: "2",
    timezone: "auto",
  });

  return `${WEATHER_URL}?${params}`;
}

async function loadWeather() {
  elements.body.classList.add("loading");
  elements.searchStatus.textContent = "Reading live weather data…";

  try {
    const response = await fetch(makeRequestUrl());

    if (!response.ok) throw new Error("Weather request failed");

    state.data = await response.json();

    // Open-Meteo gives local city times. Find the beginning of the current hour.
    const currentHour = state.data.current.time.slice(0, 13) + ":00";
    const index = state.data.hourly.time.indexOf(currentHour);

    state.startIndex = index >= 0 ? index : 0;
    state.selectedIndex = state.startIndex;

    elements.placeName.textContent = state.place.name;
    elements.placeMeta.textContent = state.place.region;

    elements.updated.textContent = `Updated ${new Intl.DateTimeFormat("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date())}`;

    elements.searchStatus.textContent = "";

    renderTimeline();
    updateScene();
    markActivePreset();

  } catch (error) {
    elements.searchStatus.textContent = "Live data could not be reached. Check your connection and try again.";
    elements.condition.textContent = "Data unavailable";
    elements.poem.textContent = "The sky is still here, but its data has gone quiet.";
    console.error(error);

  } finally {
    elements.body.classList.remove("loading");
  }
}

async function searchCity(name) {
  const params = new URLSearchParams({
    name,
    count: "1",
    language: "en",
    format: "json",
  });

  const response = await fetch(`${GEOCODING_URL}?${params}`);

  if (!response.ok) throw new Error("Location search failed");

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("No matching city was found");
  }

  const city = data.results[0];

  state.place = {
    name: city.name,
    region: [city.admin1, city.country].filter(Boolean).join(", "),
    latitude: city.latitude,
    longitude: city.longitude,
  };

  await loadWeather();
}

// Buttons and user interaction 

// Search for a new city using the form.
elements.cityForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = elements.cityInput.value.trim();
  if (!name) return;

  try {
    elements.searchStatus.textContent = `Finding ${name}…`;
    await searchCity(name);
    elements.cityInput.value = "";

  } catch (error) {
    elements.searchStatus.textContent = error.message;
  }
});

// The preset buttons already contain their coordinates in the HTML.
document.querySelectorAll(".presets button").forEach((button) => {
  button.addEventListener("click", () => {
    state.place = {
      name: button.dataset.city,
      region: button.dataset.region,
      latitude: Number(button.dataset.lat),
      longitude: Number(button.dataset.lon),
    };

    loadWeather();
  });
});

// Switch between Celsius and Fahrenheit. Keep the same selected forecast hour.
elements.unitToggle.addEventListener("click", () => {
  state.unit = state.unit === "c" ? "f" : "c";

  elements.unitToggle.querySelectorAll("span").forEach((span) => {
    span.classList.toggle("active", span.dataset.unit === state.unit);
  });

  renderTimeline();
  updateScene();
});

// Pause and resume the Canvas and CSS motion.
elements.motionToggle.addEventListener("click", () => {
  state.paused = !state.paused;

  elements.body.classList.toggle("paused", state.paused);
  elements.motionToggle.setAttribute("aria-pressed", String(state.paused));
  elements.motionToggle.textContent = state.paused ? "Resume motion" : "Pause motion";

  if (!state.paused && !state.raf) animate();
});

// Show or hide the JSON returned by Open-Meteo
elements.dataToggle.addEventListener("click", () => {
  const open = elements.dataToggle.getAttribute("aria-expanded") === "true";

  elements.dataToggle.setAttribute("aria-expanded", String(!open));
  elements.dataToggle.textContent = open ? "View data" : "Hide data";
  elements.jsonPanel.hidden = open;
});

// Animated weather particles (Canvas)

const context = elements.canvas.getContext("2d");

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  elements.canvas.width = window.innerWidth * ratio;
  elements.canvas.height = window.innerHeight * ratio;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const point = currentPoint();
  if (point) resetParticles(point);
}

function resetParticles(point) {
  const kind = kindFromCode(point.weather_code);

  const baseCount = kind === "rain" || kind === "storm" ? 145 : kind === "snow" ? 95 : 38;

  const count = Math.min(260, Math.round(
    baseCount + point.precipitation * 16 + point.cloud_cover * 0.22
  ));

  state.particles = [];

  for (let i = 0; i < count; i++) {
    state.particles.push(createParticle(kind, true));
  }
}

function createParticle(kind, randomY = false) {
  const point = currentPoint();
  const wind = point.wind_speed_10m;
  const direction = (point.wind_direction_10m - 180) * Math.PI / 180;

  const snow = kind === "snow";
  const mist = kind === "cloud" || kind === "fog" || kind === "clear";

  return {
    kind,
    x: Math.random() * window.innerWidth,
    y: randomY ? Math.random() * window.innerHeight : -20,
    size: snow ? 1.5 + Math.random() * 3.3 : mist ? 22 + Math.random() * 70 : 0.6 + Math.random() * 1.7,
    vx: Math.cos(direction) * (0.15 + wind * 0.035) + (Math.random() - 0.5) * 0.22,
    vy: snow ? 0.45 + Math.random() * 0.75 : mist ? -0.08 + Math.random() * 0.16 : 7 + Math.random() * 8 + wind * 0.08,
    alpha: mist ? 0.025 + Math.random() * 0.055 : 0.25 + Math.random() * 0.42,
    phase: Math.random() * Math.PI * 2,
  };
}

function drawParticle(particle, time) {
  context.save();
  context.globalAlpha = particle.alpha;

  if (particle.kind === "snow") {
    // Small white circles drift from side to side.
    context.fillStyle = "#f4f8ff";
    context.beginPath();

    const sway = Math.sin(time * 0.0015 + particle.phase) * 1.4;

    context.arc(particle.x + sway, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();

  } else if (particle.kind === "rain" || particle.kind === "storm") {
    // Short diagonal lines create falling rain.
    context.strokeStyle = "#c9e8ff";
    context.lineWidth = particle.size;
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(particle.x + particle.vx * 4, particle.y + particle.vy * 1.8);
    context.stroke();

  } else {
    // Soft circles create clouds, fog, or clear-air haze.
    const gradient = context.createRadialGradient(
      particle.x, particle.y, 0, particle.x, particle.y, particle.size
    );

    gradient.addColorStop(0, "rgba(255,255,255,.7)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function animate(time = 0) {
  if (state.paused) {
    state.raf = null;
    return;
  }

  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const point = currentPoint();

  if (point) {
    const kind = kindFromCode(point.weather_code);

    state.particles.forEach((particle, index) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      drawParticle(particle, time);

      // When a particle leaves the screen, create another one at the edge.
      if (
        particle.y > window.innerHeight + 100 ||
        particle.y < -120 ||
        particle.x > window.innerWidth + 120 ||
        particle.x < -120
      ) {
        state.particles[index] = createParticle(kind);
      }
    });
  }

  state.raf = requestAnimationFrame(animate);
}

// Start the website

window.addEventListener("resize", resizeCanvas);

resizeCanvas();

elements.body.classList.toggle("paused", state.paused);
elements.motionToggle.setAttribute("aria-pressed", String(state.paused));
elements.motionToggle.textContent = state.paused ? "Resume motion" : "Pause motion";

loadWeather();
animate();

// Request fresh weather data every 10 minutes.
window.setInterval(loadWeather, 10 * 60 * 1000);
