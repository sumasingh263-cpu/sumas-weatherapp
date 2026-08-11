// Default coordinates for Kathmandu / Fallback
let currentLat = 27.7172;
let currentLon = 85.3240;
let currentCityName = "Kathmandu";

// Cached last successful weather response, so unit/display toggles can
// re-render without re-fetching from the API.
let lastWeatherData = null;

// Timer/animation handles — always cleared before being re-created so we
// never end up with duplicate intervals.
let refreshTimerId = null;
let particleIntervalId = null;

const SETTINGS_STORAGE_KEY = "weatherAppSettings";

const defaultSettings = {
    temperatureUnit: "C",
    updateFrequency: "auto",

    sectionOrder: ["current-weather", "hourly", "forecast", "details", "lifestyle"],

    general: {
        language: "en",
        startLocation: "lastSearched"
    },

    weatherWidget: {
        enabled: true,
        style: "standard",
        showTemperature: true,
        showCondition: true,
        showIcon: true,
        showLocation: true,
        showHighLow: true,
        showPrecipitation: true,
        showWind: false,
        showHumidity: false,
        showFeelsLike: false
    },

    appearance: {
        theme: "system",
        weatherAnimation: true,
        animatedBackground: true,
        reduceAnimations: false
    },

    weatherInformation: {
        hourly: true,
        daily: true,
        precipitation: true,
        wind: true,
        humidity: true,
        uv: true,
        feelsLike: true,
        visibility: true,
        pressure: true,
        aqi: false
    },

    notifications: {
        weatherAlerts: true,
        rainAlerts: true,
        severeWeatherAlerts: true,
        dailySummary: false
    },

    location: {
        useCurrentLocation: false,
        rememberLastLocation: true
    }
};

let appSettings = loadSettings();

// Deep-merges saved data over the defaults so old saved blobs (or partially
// saved objects) never crash on newly added keys.
function deepMergeDefaults(defaults, saved) {
    const result = Array.isArray(defaults) ? defaults.slice() : { ...defaults };
    if (!saved || typeof saved !== "object") return result;

    Object.keys(defaults).forEach((key) => {
        const defaultVal = defaults[key];
        const savedVal = saved[key];
        if (savedVal === undefined) return;

        if (
            defaultVal &&
            typeof defaultVal === "object" &&
            !Array.isArray(defaultVal) &&
            savedVal &&
            typeof savedVal === "object" &&
            !Array.isArray(savedVal)
        ) {
            result[key] = deepMergeDefaults(defaultVal, savedVal);
        } else {
            result[key] = savedVal;
        }
    });

    return result;
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return JSON.parse(JSON.stringify(defaultSettings));
        const parsed = JSON.parse(raw);
        return deepMergeDefaults(defaultSettings, parsed);
    } catch (err) {
        console.error("Failed to load settings, using defaults:", err);
        return JSON.parse(JSON.stringify(defaultSettings));
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
    } catch (err) {
        // localStorage may be unavailable (private browsing, quota, etc).
        // The app keeps working in-memory for the session; it just won't persist.
        console.error("Failed to save settings:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    initSettingsUI();
    applyTheme();
    applySectionOrder();
    applyUpdateFrequency();
    fetchWeatherData(currentLat, currentLon, currentCityName);
}

function setupEventListeners() {
    const locationToggleBtn = document.getElementById("location-toggle-btn");
    const closeSearchBtn = document.getElementById("close-search-btn");
    const searchContainer = document.getElementById("search-container");
    const searchInput = document.getElementById("search-input");
    const currentLocBtn = document.getElementById("current-loc-btn");

    locationToggleBtn.addEventListener("click", () => {
        searchContainer.classList.remove("hidden");
        searchInput.focus();
    });

    closeSearchBtn.addEventListener("click", () => {
        searchContainer.classList.add("hidden");
    });

    currentLocBtn.addEventListener("click", () => {
        searchContainer.classList.add("hidden");
        fetchUserLocationWeather();
    });

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        if (query.length > 2) {
            searchCityAutocomplete(query);
        } else {
            document.getElementById("suggestions-list").innerHTML = "";
        }
    });
}

function showErrorBanner(message) {
    const banner = document.getElementById("error-banner");
    banner.textContent = message;
    banner.classList.remove("hidden");
}

function hideErrorBanner() {
    const banner = document.getElementById("error-banner");
    banner.classList.add("hidden");
}

function fetchUserLocationWeather() {
    if (!navigator.geolocation) {
        showErrorBanner("Geolocation is not supported by your browser.");
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            hideErrorBanner();
            reverseGeocode(lat, lon);
        },
        (error) => {
            let errorMessage = "Unable to retrieve GPS location. Please search manually.";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = "Location permission denied. Please allow access in browser settings.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = "Location information is currently unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage = "Location request timed out. Please try again.";
                    break;
            }
            showErrorBanner(errorMessage);
        },
        options
    );
}

async function searchCityAutocomplete(query) {
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
        const data = await res.json();
        const listEl = document.getElementById("suggestions-list");
        listEl.innerHTML = "";

        if (data && data.results) {
            data.results.forEach(city => {
                const li = document.createElement("li");
                li.textContent = `${city.name}, ${city.country || ''} (${city.admin1 || ''})`;
                li.addEventListener("click", () => {
                    hideErrorBanner();
                    currentLat = city.latitude;
                    currentLon = city.longitude;
                    currentCityName = city.name;
                    document.getElementById("city-title").textContent = currentCityName;
                    document.getElementById("search-container").classList.add("hidden");
                    document.getElementById("search-input").value = "";
                    listEl.innerHTML = "";
                    fetchWeatherData(currentLat, currentLon, currentCityName);
                });
                listEl.appendChild(li);
            });
        }
    } catch (err) {
        console.error("Autocomplete error:", err);
    }
}

function reverseGeocode(lat, lon) {
    currentLat = lat;
    currentLon = lon;
    currentCityName = "Current Location";
    document.getElementById("city-title").textContent = currentCityName;
    fetchWeatherData(currentLat, currentLon, currentCityName);
}

async function fetchWeatherData(lat, lon, cityName) {
    try {
        hideErrorBanner(); // Clear any previous error banner upon successful data call
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch weather data");
        const data = await response.json();

        lastWeatherData = data;
        currentCityName = cityName;

        renderAllWeather(data, cityName);
        applyWeatherVisuals();

    } catch (err) {
        console.error(err);
        showErrorBanner("Failed to load weather data. Please try again.");
    }
}

// Renders every part of the dashboard from a weather-data payload. Used both
// after a fresh fetch and after a settings change (unit, toggles) so we
// never need a second fetch just to re-render. Does not touch the animated
// background/particles — that's a separate concern, see applyWeatherVisuals().
function renderAllWeather(data, cityName) {
    updateCurrentWeather(data, cityName);
    updateHourlyWeather(data);
    updateDailyForecast(data);
    updateDetails(data);
    updateLifestyle(data);
    updateWeatherWidgetPreview(data, cityName);
    applyWeatherInformationVisibility();
}

// Re-renders from the cached payload only — no network call. Used when the
// user changes display settings like temperature unit or info toggles.
function rerenderFromCache() {
function rerenderFromCache() {
    if (!lastWeatherData) return;
    renderAllWeather(lastWeatherData, currentCityName);
}

// Single source of truth for temperature display. Every place that shows a
// temperature routes through here so a unit change only ever needs to
// update this one function's output, not each caller.
function formatTemp(celsius) {
    if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return "--°";
    const value = appSettings.temperatureUnit === "F"
        ? (celsius * 9 / 5) + 32
        : celsius;
    return `${Math.round(value)}°`;
}

function updateCurrentWeather(data, cityName) {
    document.getElementById("city-title").textContent = cityName;
    const current = data.current;
    const daily = data.daily;

    document.getElementById("temp-display").textContent = formatTemp(current.temperature_2m);
    
    if (daily && daily.temperature_2m_max && daily.temperature_2m_min) {
        const high = formatTemp(daily.temperature_2m_max[0]);
        const low = formatTemp(daily.temperature_2m_min[0]);
        document.getElementById("high-low-display").textContent = `High: ${high} Low: ${low}`;
    }

    document.getElementById("weather-condition").textContent = getWeatherDescription(current.weather_code);
}

function updateHourlyWeather(data) {
    const hourlyScroll = document.getElementById("hourly-scroll");
    hourlyScroll.innerHTML = "";

    const times = data.hourly.time;
    const temps = data.hourly.temperature_2m;
    const codes = data.hourly.weather_code;
    const precip = data.hourly.precipitation_probability;

    const nowIndex = new Date().getHours();
    
    for (let i = nowIndex; i < nowIndex + 24 && i < times.length; i++) {
        const dateObj = new Date(times[i]);
        const timeLabel = i === nowIndex ? "Now" : dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const temp = formatTemp(temps[i]);
        const icon = getWeatherIcon(codes[i]);
        const showRain = appSettings.weatherInformation.precipitation;
        const rainProb = showRain && precip[i] > 0 ? `${precip[i]}%` : "";

        const item = document.createElement("div");
        item.className = "hourly-item";
        item.innerHTML = `
            <span class="hourly-time">${timeLabel}</span>
            <span class="hourly-icon">${icon}</span>
            <span class="hourly-temp">${temp}</span>
            <span class="hourly-rain">${rainProb}</span>
        `;
        hourlyScroll.appendChild(item);
    }
}

function updateDailyForecast(data) {
    const forecastList = document.getElementById("forecast-list");
    forecastList.innerHTML = "";

    const days = data.daily.time;
    const maxs = data.daily.temperature_2m_max;
    const mins = data.daily.temperature_2m_min;
    const codes = data.daily.weather_code;

    const overallMax = Math.max(...maxs);
    const overallMin = Math.min(...mins);
    const span = overallMax - overallMin || 1;

    days.forEach((dayStr, index) => {
        // Correct local date parsing without timezone offset shifts
        const [year, month, day] = dayStr.split('-');
        const date = new Date(year, month - 1, day);
        const dayName = index === 0 ? "Today" : date.toLocaleDateString([], { weekday: 'short' });
        
        const max = formatTemp(maxs[index]);
        const min = formatTemp(mins[index]);
        const icon = getWeatherIcon(codes[index]);

        // Bar proportions are computed from raw Celsius values — since °F is
        // a linear transform of °C, the relative percentages are identical
        // in either unit, so no conversion is needed here.
        const leftPercent = ((mins[index] - overallMin) / span) * 100;
        const widthPercent = ((maxs[index] - mins[index]) / span) * 100;

        const row = document.createElement("div");
        row.className = "forecast-row";
        row.innerHTML = `
            <span class="forecast-day">${dayName}</span>
            <span class="forecast-icon-wrap">${icon}</span>
            <div class="forecast-bar-track">
                <div class="forecast-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
            </div>
            <div class="forecast-temps">
                <span>${max}</span>
                <span>${min}</span>
            </div>
        `;
        forecastList.appendChild(row);
    });
}

function updateDetails(data) {
    const current = data.current;
    const daily = data.daily;

    const uvVal = daily.uv_index_max ? daily.uv_index_max[0] : 5;
    document.getElementById("uv-num").textContent = uvVal;
    document.getElementById("uv-level").textContent = uvVal > 8 ? "Very High" : uvVal > 5 ? "High" : "Moderate";

    const feels = formatTemp(current.apparent_temperature);
    const actual = formatTemp(current.temperature_2m);
    document.getElementById("feels-val").textContent = feels;
    document.getElementById("feels-actual").textContent = `Actual temperature: ${actual}`;

    const windSpeed = Math.round(current.wind_speed_10m);
    const windDir = current.wind_direction_10m;
    document.getElementById("wind-val").textContent = windSpeed;
    document.getElementById("compass-needle").style.transform = `rotate(${windDir}deg)`;

    if (daily.sunrise && daily.sunset) {
        const sunriseTime = new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const sunsetTime = new Date(daily.sunset[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        document.getElementById("sunset-val").textContent = sunsetTime.toLowerCase();
        document.getElementById("sunrise-val").textContent = `Sunrise: ${sunriseTime.toLowerCase()}`;
    }

    const humidity = current.relative_humidity_2m;
    document.getElementById("humidity-val").textContent = `${humidity} %`;

    const pressure = current.surface_pressure;
    document.getElementById("pressure-val").textContent = `${Math.round(pressure)} hPa`;

    // visibility is an hourly field in Open-Meteo, not a current field
    const nowHour = new Date().getHours();
    if (data.hourly && Array.isArray(data.hourly.visibility) && typeof data.hourly.visibility[nowHour] === "number") {
        const visibilityKm = (data.hourly.visibility[nowHour] / 1000).toFixed(1);
        document.getElementById("visibility-val").textContent = `${visibilityKm} km`;
    }
}

function updateLifestyle(data) {
    const current = data.current;
    const temp = current.temperature_2m;
    
    document.getElementById("fishing-desc").textContent = temp > 15 && temp < 30 ? "Favorable conditions" : "Sub-optimal conditions";
    document.getElementById("clothing-desc").textContent = temp < 15 ? "Wear a jacket or warm layers" : "Light clothing is recommended";
    document.getElementById("health-desc").textContent = "Low pollen levels expected today";
    document.getElementById("star-desc").textContent = current.weather_code === 0 ? "Clear skies, great for stargazing" : "Cloudy skies, poor visibility";
}

function getWeatherDescription(code) {
    const descriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        51: "Light drizzle",
        61: "Light rain",
        63: "Moderate rain",
        80: "Rain showers",
        95: "Thunderstorm with hail"
    };
    return descriptions[code] || "Fair";
}

function getWeatherIcon(code) {
    if (code === 0) return "☀️";
    if (code >= 1 && code <= 2) return "⛅";
    if (code === 3) return "☁️";
    if (code >= 51 && code <= 67) return "🌧️";
    if (code >= 71 && code <= 77) return "❄️";
    if (code >= 95) return "⛈️";
    return "🌤️";
}


/* =========================================================================
   WEATHER INFORMATION VISIBILITY (Settings → Weather information)
   Shows/hides whole dashboard sections and individual detail cards. Cards
   stay in the DOM (display:none) rather than being removed, so re-enabling
   a toggle doesn't require re-fetching or rebuilding anything.
   ========================================================================= */
function applyWeatherInformationVisibility() {
    const info = appSettings.weatherInformation;

    setSectionVisible("hourly", info.hourly);
    setSectionVisible("forecast", info.daily);

    setDetailCardVisible("wind", info.wind);
    setDetailCardVisible("humidity", info.humidity);
    setDetailCardVisible("uv", info.uv);
    setDetailCardVisible("feelsLike", info.feelsLike);
    setDetailCardVisible("visibility", info.visibility);
    setDetailCardVisible("pressure", info.pressure);
    // AQI has no card yet (the current API pipeline doesn't provide air
    // quality data) — the toggle is disabled in the UI, nothing to apply.
}

function setSectionVisible(sectionId, visible) {
    const el = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!el) return;
    el.classList.toggle("hidden", !visible);
}

function setDetailCardVisible(detailId, visible) {
    const el = document.querySelector(`[data-detail-id="${detailId}"]`);
    if (!el) return;
    el.classList.toggle("hidden", !visible);
}


/* =========================================================================
   SECTION ORDER (three-dot menu → Reset to default order)
   Applies appSettings.sectionOrder to the dashboard via CSS `order`. This is
   fully independent of "Reset app data" — it only ever touches order.
   ========================================================================= */

function applySectionOrder() {
    appSettings.sectionOrder.forEach((sectionId, index) => {
        const el = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (el) el.style.order = index;
    });
}

function resetToDefaultOrder() {
    appSettings.sectionOrder = [...defaultSettings.sectionOrder];
    saveSettings();
    applySectionOrder();
}


/* =========================================================================
   TEMPERATURE UNIT
   ========================================================================= */

function setTemperatureUnit(unit) {
    if (unit !== "C" && unit !== "F") return;
    appSettings.temperatureUnit = unit;
    saveSettings();
    rerenderFromCache();
    syncTempUnitControls();
}

function syncTempUnitControls() {
    const unit = appSettings.temperatureUnit;
    const quickC = document.getElementById("tempunit-c");
    const quickF = document.getElementById("tempunit-f");
    const settingsC = document.getElementById("settings-tempunit-c");
    const settingsF = document.getElementById("settings-tempunit-f");
    if (quickC) quickC.checked = unit === "C";
    if (quickF) quickF.checked = unit === "F";
    if (settingsC) settingsC.checked = unit === "C";
    if (settingsF) settingsF.checked = unit === "F";
}


/* =========================================================================
   UPDATE FREQUENCY
   Always clears the previous interval before creating a new one, so there
   is never more than one refresh timer alive at once.
   ========================================================================= */

const FREQUENCY_MINUTES = {
    auto: 30,
    "15": 15,
    "30": 30,
    "60": 60,
    "180": 180
};

function applyUpdateFrequency() {
    if (refreshTimerId) {
        clearInterval(refreshTimerId);
        refreshTimerId = null;
    }

    const freq = appSettings.updateFrequency;
    if (freq === "manual") return; // no automatic refresh

    const minutes = FREQUENCY_MINUTES[freq] || FREQUENCY_MINUTES.auto;
    refreshTimerId = setInterval(() => {
        fetchWeatherData(currentLat, currentLon, currentCityName);
    }, minutes * 60 * 1000);
}

function setUpdateFrequency(freq) {
    appSettings.updateFrequency = freq;
    saveSettings();
    applyUpdateFrequency();
}


/* =========================================================================
   THEME
   ========================================================================= */

let systemThemeMediaQuery = null;

function applyTheme() {
    const theme = appSettings.appearance.theme;
    const effectiveTheme = theme === "system" ? getSystemTheme() : theme;
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.setAttribute(
        "data-reduce-animations",
        appSettings.appearance.reduceAnimations ? "true" : "false"
    );

    // Keep following the OS setting live, but only ever register one listener.
    if (!systemThemeMediaQuery) {
        systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: light)");
        systemThemeMediaQuery.addEventListener("change", () => {
            if (appSettings.appearance.theme === "system") applyTheme();
        });
    }
}

function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
}

function setTheme(theme) {
    appSettings.appearance.theme = theme;
    saveSettings();
    applyTheme();
}


/* =========================================================================
   WEATHER ANIMATION / ANIMATED BACKGROUND
   Preserves the existing rain/snow particle CSS (fallRain/fallSnow,
   .rain-particle/.snow-particle) and existing #weather-bg element — this
   wires real weather-condition-driven behaviour into them rather than
   introducing a second system.
   ========================================================================= */

const WEATHER_BACKGROUNDS = {
clear:   { day: "linear-gradient(135deg, #4a90d9 0%, #2c5f8a 100%)", night: "linear-gradient(135deg, #1b2540 0%, #0c1220 100%)" },
    cloudy:  { day: "linear-gradient(135deg, #5c6b7a 0%, #384959 100%)", night: "linear-gradient(135deg, #2a3542 0%, #151c24 100%)" },
    rain:    { day: "linear-gradient(135deg, #3a4a5c 0%, #1c2630 100%)", night: "linear-gradient(135deg, #202a35 0%, #10151c 100%)" },
    snow:    { day: "linear-gradient(135deg, #7a8ba0 0%, #4a5a6c 100%)", night: "linear-gradient(135deg, #2e3a48 0%, #161d24 100%)" },
    storm:   { day: "linear-gradient(135deg, #2e3440 0%, #14181f 100%)", night: "linear-gradient(135deg, #1a1e26 0%, #0a0c0f 100%)" }
};

function classifyWeatherCode(code) {
    if (code === 0 || code === 1) return "clear";
    if (code === 2 || code === 3 || code === 45) return "cloudy";
    if (code >= 51 && code <= 67) return "rain";
    if (code >= 71 && code <= 77) return "snow";
    if (code >= 80 && code <= 82) return "rain";
    if (code >= 95) return "storm";
    return "clear";
}

function applyWeatherVisuals() {
    if (particleIntervalId) {
        clearInterval(particleIntervalId);
        particleIntervalId = null;
    }
    const particlesContainer = document.getElementById("particles-container");
    if (particlesContainer) particlesContainer.innerHTML = "";

    if (!lastWeatherData) return;

    const code = lastWeatherData.current.weather_code;
    const isDay = lastWeatherData.current.is_day !== 0;
    const category = classifyWeatherCode(code);

    // Background
    const bgEl = document.getElementById("weather-bg");
    if (bgEl) {
        if (appSettings.appearance.animatedBackground) {
            const variant = WEATHER_BACKGROUNDS[category] || WEATHER_BACKGROUNDS.clear;
            bgEl.style.background = isDay ? variant.day : variant.night;
        } else {
            bgEl.style.background = ""; // falls back to the default --bg-gradient
        }
    }

    // Particles
    if (!appSettings.appearance.weatherAnimation) return;
    if (category !== "rain" && category !== "snow") return;

    const particleType = category === "rain" ? "rain-particle" : "snow-particle";
    const maxParticles = appSettings.appearance.reduceAnimations ? 14 : 40;
    let spawned = 0;

    particleIntervalId = setInterval(() => {
        if (!particlesContainer) return;
        if (spawned >= maxParticles) spawned = 0; // recycle count, keep DOM small

        const particle = document.createElement("div");
        particle.className = particleType;
        particle.style.left = `${Math.random() * 100}%`;
        const duration = category === "rain" ? 0.6 + Math.random() * 0.5 : 3 + Math.random() * 3;
        particle.style.animationDuration = `${duration}s`;
        particlesContainer.appendChild(particle);
        spawned++;

        // Clean up each particle after its animation finishes so the
        // particle container never grows without bound.
        setTimeout(() => particle.remove(), duration * 1000 + 200);
    }, category === "rain" ? 90 : 260);
}


/* =========================================================================
   WEATHER WIDGET PREVIEW
   Configures a compact preview of what an eventual Android home-screen
   widget would show, driven entirely by appSettings.weatherWidget.
   ========================================================================= */

function updateWeatherWidgetPreview(data, cityName) {
    const preview = document.getElementById("widget-preview");
    if (!preview) return;

    if (!data || !data.current) {
        preview.innerHTML = `<div class="row-note">Loading…</div>`;
        return;
    }

    const w = appSettings.weatherWidget;
    if (!w.enabled) {
        preview.innerHTML = `<div class="row-note">Widget is turned off</div>`;
        return;
    }

    const current = data.current;
    const daily = data.daily;
    const parts = [];

    if (w.showIcon || w.showCondition) {
        const iconHtml = w.showIcon ? `<div>${getWeatherIcon(current.weather_code)}</div>` : "";
        const conditionHtml = w.showCondition ? `<div class="wp-condition">${getWeatherDescription(current.weather_code)}</div>` : "";
        parts.push(iconHtml + conditionHtml);
    }
    if (w.showTemperature) {
        parts.push(`<div class="wp-temp">${formatTemp(current.temperature_2m)}</div>`);
    }
    if (w.showLocation) {
        parts.push(`<div>${cityName}</div>`);
    }

    const rowItems = [];
    if (w.showHighLow && daily && daily.temperature_2m_max) {
        rowItems.push(`H:${formatTemp(daily.temperature_2m_max[0])} L:${formatTemp(daily.temperature_2m_min[0])}`);
    }
    if (w.showPrecipitation && data.hourly && data.hourly.precipitation_probability) {
        rowItems.push(`${data.hourly.precipitation_probability[new Date().getHours()] || 0}% rain`);
    }
    if (w.showWind) {
        rowItems.push(`${Math.round(current.wind_speed_10m)} km/h wind`);
    }
    if (w.showHumidity) {
        rowItems.push(`${current.relative_humidity_2m}% humidity`);
    }
    if (w.showFeelsLike) {
        rowItems.push(`Feels ${formatTemp(current.apparent_temperature)}`);
    }

    if (rowItems.length) {
        parts.push(`<div class="wp-row">${rowItems.map(t => `<span>${t}</span>`).join("")}</div>`);
    }

    // Widget style trims how much of the above actually renders.
    let visibleParts = parts;
    if (w.style === "compact") visibleParts = parts.slice(0, 2);
    else if (w.style === "standard") visibleParts = parts.slice(0, 3);
    // "detailed" shows everything selected

    preview.innerHTML = visibleParts.join("") || `<div class="row-note">Nothing selected to show</div>`;
}


/* =========================================================================
   THREE-DOT MENU + PANELS + SETTINGS PAGE
   Wiring is attached exactly once from initSettingsUI() (called once from
   initApp()). Values are (re)populated separately via
   populateSettingsControls() so a data reset can refresh the UI without
   re-attaching listeners.
   ========================================================================= */

const WIDGET_TOGGLE_FIELDS = [
    ["widget-show-temp", "showTemperature"],
    ["widget-show-condition", "showCondition"],
    ["widget-show-icon", "showIcon"],
    ["widget-show-location", "showLocation"],
    ["widget-show-highlow", "showHighLow"],
    ["widget-show-precip", "showPrecipitation"],
    ["widget-show-wind", "showWind"],
    ["widget-show-humidity", "showHumidity"],
    ["widget-show-feelslike", "showFeelsLike"]
];

const WEATHER_INFO_TOGGLE_FIELDS = [
    ["setting-info-hourly", "hourly"],
    ["setting-info-daily", "daily"],
    ["setting-info-precipitation", "precipitation"],
    ["setting-info-wind", "wind"],
    ["setting-info-humidity", "humidity"],
    ["setting-info-uv", "uv"],
    ["setting-info-feelslike", "feelsLike"],
    ["setting-info-visibility", "visibility"],
    ["setting-info-pressure", "pressure"]
];

const NOTIF_TOGGLE_FIELDS = [
    ["setting-notif-weather", "weatherAlerts"],
    ["setting-notif-rain", "rainAlerts"],
    ["setting-notif-severe", "severeWeatherAlerts"],
    ["setting-notif-daily-summary", "dailySummary"]
];

const LOCATION_TOGGLE_FIELDS = [
    ["setting-loc-use-current", "useCurrentLocation"],
    ["setting-loc-remember-last", "rememberLastLocation"]
];

const FREQ_RADIO_MAP = {
    "freq-auto": "auto",
    "freq-15": "15",
    "freq-30": "30",
    "freq-60": "60",
    "freq-180": "180",
    "freq-manual": "manual"
};

function wireToggleListener(id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => onChange(el.checked));
}

function wireRadioListener(id, onSelect) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
        if (el.checked) onSelect();
    });
}

function openPanel(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.add("open");
}

function closePanel(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.remove("open");
}

const ALL_PANEL_IDS = [
    "widget-panel-overlay",
    "tempunit-panel-overlay",
    "frequency-panel-overlay",
    "settings-panel-overlay",
    "reset-order-confirm-overlay",
    "reset-data-confirm-overlay"
];

function wireMenu() {
    const menuBtn = document.getElementById("menu-btn");
    const menu = document.getElementById("overflow-menu");
    if (!menuBtn || !menu) return;

    function openMenu() {
        menu.classList.add("open");
        menuBtn.setAttribute("aria-expanded", "true");
    }
    function closeMenu() {
        menu.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
    }

    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menu.classList.contains("open")) closeMenu();
        else openMenu();
    });

    // Close on outside click — single delegated listener, not re-added per open.
    document.addEventListener("click", (e) => {
        if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== menuBtn) {
            closeMenu();
        }
    });

    // Close on Escape.
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && menu.classList.contains("open")) closeMenu();
    });

    document.getElementById("menu-item-widget").addEventListener("click", () => {
        closeMenu();
        updateWeatherWidgetPreview(lastWeatherData, currentCityName);
        openPanel("widget-panel-overlay");
    });
    document.getElementById("menu-item-tempunit").addEventListener("click", () => {
        closeMenu();
        openPanel("tempunit-panel-overlay");
    });
    document.getElementById("menu-item-frequency").addEventListener("click", () => {
        closeMenu();
        openPanel("frequency-panel-overlay");
    });
    document.getElementById("menu-item-reset-order").addEventListener("click", () => {
        closeMenu();
        openPanel("reset-order-confirm-overlay");
    });
    document.getElementById("menu-item-settings").addEventListener("click", () => {
        closeMenu();
        openPanel("settings-panel-overlay");
    });
}

function wirePanels() {
    // Clicking the dim backdrop (not the sheet/dialog itself) closes a panel.
    ALL_PANEL_IDS.forEach((id) => {
        const overlay = document.getElementById(id);
        if (!overlay) return;
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closePanel(id);
        });
    });

    // Escape closes whichever panel is currently open — single listener.
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        ALL_PANEL_IDS.forEach((id) => {
            const overlay = document.getElementById(id);
            if (overlay && overlay.classList.contains("open")) closePanel(id);
        });
    });

    const closeButtonMap = {
        "widget-panel-close": "widget-panel-overlay",
        "tempunit-panel-close": "tempunit-panel-overlay",
        "frequency-panel-close": "frequency-panel-overlay",
        "settings-panel-close": "settings-panel-overlay"
    };
    Object.keys(closeButtonMap).forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener("click", () => closePanel(closeButtonMap[btnId]));
    });
}

function wireWidgetPanel() {
    wireToggleListener("widget-enabled", (val) => {
        appSettings.weatherWidget.enabled = val;
        saveSettings();
        updateWeatherWidgetPreview(lastWeatherData, currentCityName);
    });

    ["compact", "standard", "detailed"].forEach((style) => {
        wireRadioListener(`widget-style-${style}`, () => {
            appSettings.weatherWidget.style = style;
            saveSettings();
            updateWeatherWidgetPreview(lastWeatherData, currentCityName);
        });
    });

    WIDGET_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.weatherWidget[field] = val;
            saveSettings();
            updateWeatherWidgetPreview(lastWeatherData, currentCityName);
        });
    });
}

function wireTempUnitPanel() {
    wireRadioListener("tempunit-c", () => setTemperatureUnit("C"));
    wireRadioListener("tempunit-f", () => setTemperatureUnit("F"));
    wireRadioListener("settings-tempunit-c", () => setTemperatureUnit("C"));
    wireRadioListener("settings-tempunit-f", () => setTemperatureUnit("F"));
}

function wireFrequencyPanel() {
    Object.keys(FREQ_RADIO_MAP).forEach((id) => {
        wireRadioListener(id, () => setUpdateFrequency(FREQ_RADIO_MAP[id]));
    });
}

function wireSettingsPanel() {
    // General
    const langEl = document.getElementById("setting-language");
    if (langEl) {
        langEl.addEventListener("change", () => {
            appSettings.general.language = langEl.value;
            saveSettings();
        });
    }

    wireRadioListener("start-location-current", () => {
        appSettings.general.startLocation = "current";
        saveSettings();
    });
    wireRadioListener("start-location-last", () => {
        appSettings.general.startLocation = "lastSearched";
        saveSettings();
    });

    // Appearance
    wireRadioListener("theme-system", () => setTheme("system"));
    wireRadioListener("theme-light", () => setTheme("light"));
    wireRadioListener("theme-dark", () => setTheme("dark"));

    wireToggleListener("setting-weather-animation", (val) => {
        appSettings.appearance.weatherAnimation = val;
        saveSettings();
        applyWeatherVisuals();
    });
    wireToggleListener("setting-animated-background", (val) => {
        appSettings.appearance.animatedBackground = val;
        saveSettings();
        applyWeatherVisuals();
    });
    wireToggleListener("setting-reduce-animations", (val) => {
        appSettings.appearance.reduceAnimations = val;
        saveSettings();
        applyTheme();
        applyWeatherVisuals();
    });

    // Weather information
    WEATHER_INFO_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.weatherInformation[field] = val;
            saveSettings();
            rerenderFromCache();
        });
    });
    // AQI toggle is intentionally disabled in the markup — no data source
    // exists in the current API pipeline, so it's shown but not wired.

    // Notifications — settings/state only, no native notification calls.
    NOTIF_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.notifications[field] = val;
            saveSettings();
        });
    });

    // Location
    LOCATION_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.location[field] = val;
            saveSettings();
        });
    });

    // Data
    const clearBtn = document.getElementById("clear-cache-btn");
    if (clearBtn) clearBtn.addEventListener("click", clearCachedWeatherData);

    const resetDataBtn = document.getElementById("reset-app-data-btn");
    if (resetDataBtn) {
        resetDataBtn.addEventListener("click", () => openPanel("reset-data-confirm-overlay"));
    }
}

function wireConfirmDialogs() {
    const orderCancel = document.getElementById("reset-order-cancel-btn");
    const orderConfirm = document.getElementById("reset-order-confirm-btn");
    if (orderCancel) orderCancel.addEventListener("click", () => closePanel("reset-order-confirm-overlay"));
    if (orderConfirm) {
        orderConfirm.addEventListener("click", () => {
            resetToDefaultOrder();
            closePanel("reset-order-confirm-overlay");
        });
    }

    const dataCancel = document.getElementById("reset-data-cancel-btn");
    const dataConfirm = document.getElementById("reset-data-confirm-btn");
    if (dataCancel) dataCancel.addEventListener("click", () => closePanel("reset-data-confirm-overlay"));
    if (dataConfirm) {
        dataConfirm.addEventListener("click", () => {
            resetAppData();
            closePanel("reset-data-confirm-overlay");
            closePanel("settings-panel-overlay");
        });
    }
}

// Sets every control's displayed value from appSettings, without attaching
// any listeners. Safe to call repeatedly (e.g. after a data reset).
function populateSettingsControls() {
    syncTempUnitControls();

    Object.keys(FREQ_RADIO_MAP).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.checked = appSettings.updateFrequency === FREQ_RADIO_MAP[id];
    });

    const w = appSettings.weatherWidget;
    const widgetEnabledEl = document.getElementById("widget-enabled");
    if (widgetEnabledEl) widgetEnabledEl.checked = w.enabled;
    ["compact", "standard", "detailed"].forEach((style) => {
        const el = document.getElementById(`widget-style-${style}`);
        if (el) el.checked = w.style === style;
    });
    WIDGET_TOGGLE_FIELDS.forEach(([id, field]) => {
        const el = document.getElementById(id);
        if (el) el.checked = w[field];
    });

    const langEl = document.getElementById("setting-language");
    if (langEl) langEl.value = appSettings.general.language;
    const startCurrent = document.getElementById("start-location-current");
    const startLast = document.getElementById("start-location-last");
    if (startCurrent) startCurrent.checked = appSettings.general.startLocation === "current";
    if (startLast) startLast.checked = appSettings.general.startLocation === "lastSearched";

    const theme = appSettings.appearance.theme;
    const themeSystem = document.getElementById("theme-system");
    const themeLight = document.getElementById("theme-light");
    const themeDark = document.getElementById("theme-dark");
    if (themeSystem) themeSystem.checked = theme === "system";
    if (themeLight) themeLight.checked = theme === "light";
    if (themeDark) themeDark.checked = theme === "dark";

    const weatherAnimEl = document.getElementById("setting-weather-animation");
    if (weatherAnimEl) weatherAnimEl.checked = appSettings.appearance.weatherAnimation;
    const animBgEl = document.getElementById("setting-animated-background");
    if (animBgEl) animBgEl.checked = appSettings.appearance.animatedBackground;
    const reduceAnimEl = document.getElementById("setting-reduce-animations");
    if (reduceAnimEl) reduceAnimEl.checked = appSettings.appearance.reduceAnimations;

    WEATHER_INFO_TOGGLE_FIELDS.forEach(([id, field]) => {
        const el = document.getElementById(id);
        if (el) el.checked = appSettings.weatherInformation[field];
    });
    const aqiEl = document.getElementById("setting-info-aqi");
    if (aqiEl) aqiEl.checked = appSettings.weatherInformation.aqi;

    NOTIF_TOGGLE_FIELDS.forEach(([id, field]) => {
        const el = document.getElementById(id);
        if (el) el.checked = appSettings.notifications[field];
    });

    LOCATION_TOGGLE_FIELDS.forEach(([id, field]) => {
        const el = document.getElementById(id);
        if (el) el.checked = appSettings.location[field];
    });
}

function initSettingsUI() {
    populateSettingsControls();
    wireMenu();
    wirePanels();
    wireWidgetPanel();
    wireTempUnitPanel();
    wireFrequencyPanel();
    wireSettingsPanel();
    wireConfirmDialogs();
}


/* =========================================================================
   DATA SECTION (Settings → Data)
   ========================================================================= */

// Clears the cached weather payload and re-fetches fresh data. Does not
// touch appSettings at all.
function clearCachedWeatherData() {
    lastWeatherData = null;
    fetchWeatherData(currentLat, currentLon, currentCityName);
}

// Full reset — settings AND cached data back to defaults. Deliberately a
// separate code path from resetToDefaultOrder() so the two can never be
// conflated: this touches everything, that touches only section order.
function resetAppData() {
    appSettings = JSON.parse(JSON.stringify(defaultSettings));
    saveSettings();
    lastWeatherData = null;
    populateSettingsControls();
    applySectionOrder();
    applyTheme();
    applyUpdateFrequency();
    fetchWeatherData(currentLat, currentLon, currentCityName);
}