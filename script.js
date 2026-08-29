// Default coordinates for Kathmandu / Fallback
let currentLat = 27.7172;
let currentLon = 85.3240;
let currentCityName = "Kathmandu";

// Cached last successful weather response
let lastWeatherData = null;

let refreshTimerId = null;
let particleIntervalId = null;

const SETTINGS_STORAGE_KEY = "weatherAppSettings";

const defaultSettings = {
    temperatureUnit: "C",
    windUnit: "km/h",
    updateFrequency: "auto",
    favorites: ["Kathmandu"],

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
    const addFavBtn = document.getElementById("add-fav-btn");

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

    if (addFavBtn) {
        addFavBtn.addEventListener("click", () => {
            if (!appSettings.favorites.includes(currentCityName)) {
                appSettings.favorites.push(currentCityName);
                saveSettings();
                alert(`${currentCityName} added to your favorite locations!`);
            } else {
                alert(`${currentCityName} is already in your favorites.`);
            }
        });
    }

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
        hideErrorBanner();
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

function renderAllWeather(data, cityName) {
    try {
        updateCurrentWeather(data, cityName);
        updateHourlyWeather(data);
        updateDailyForecast(data);
        updateDetails(data);
        updateLifestyle(data);
        updateWeatherWidgetPreview(data, cityName);
        applyWeatherInformationVisibility();
        hideErrorBanner(); // Explicitly clear banner once rendering succeeds
    } catch (err) {
        console.error("Rendering error:", err);
    }
}
function rerenderFromCache() {
    if (!lastWeatherData) return;
    renderAllWeather(lastWeatherData, currentCityName);
}

function formatTemp(celsius) {
    if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return "--°";
    const value = appSettings.temperatureUnit === "F"
        ? (celsius * 9 / 5) + 32
        : celsius;
    return `${Math.round(value)}°`;
}

function formatWind(speedKmh) {
    if (speedKmh === null || speedKmh === undefined || Number.isNaN(speedKmh)) return "--";
    if (appSettings.windUnit === "mph") {
        return `${Math.round(speedKmh * 0.621371)}`;
    }
    return `${Math.round(speedKmh)}`;
}

function getWindUnitLabel() {
    return appSettings.windUnit === "mph" ? "mph" : "km/h";
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
    if (!hourlyScroll) return;
    hourlyScroll.innerHTML = "";

    const times = data.hourly.time;
    const temps = data.hourly.temperature_2m;
    const codes = data.hourly.weather_code;
    const precip = data.hourly.precipitation_probability;

    const currentHourStr = data.current.time.substring(0, 13);
    const startIndex = Math.max(0, times.findIndex(t => t.startsWith(currentHourStr)));

    for (let i = startIndex; i < startIndex + 24 && i < times.length; i++) {
        const dateObj = new Date(times[i]);
        const timeLabel = i === startIndex ? "Now" : dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
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
function classifyWeatherCode(code) {
    if (code === 0 || code === 1)                  return "clear";
    if (code === 2 || code === 3)                  return "cloudy";
    if (code === 45 || code === 48)                return "fog";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86)  return "snow";
    if (code >= 95)                                return "storm";
    return "clear";
}

function updateDailyForecast(data) {
    const forecastList = document.getElementById("forecast-list");
    if (!forecastList) return;
    forecastList.innerHTML = "";

    const days = data.daily.time;
    const maxs = data.daily.temperature_2m_max;
    const mins = data.daily.temperature_2m_min;
    const codes = data.daily.weather_code;

    const overallMax = Math.max(...maxs);
    const overallMin = Math.min(...mins);
    const span = overallMax - overallMin || 1;

    days.forEach((dayStr, index) => {
        const [year, month, day] = dayStr.split('-');
        const date = new Date(year, month - 1, day);
        const dayName = index === 0 ? "Today" : date.toLocaleDateString([], { weekday: 'short' });
        
        const max = formatTemp(maxs[index]);
        const min = formatTemp(mins[index]);
        const icon = getWeatherIcon(codes[index]);

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

    // UV Index
    const uvVal = daily.uv_index_max ? Math.round(daily.uv_index_max[0]) : 5;
    const uvEl = document.getElementById("uv-num");
    const uvLvlEl = document.getElementById("uv-level");
    const uvDescEl = document.getElementById("uv-desc");
    if (uvEl) uvEl.textContent = uvVal;
    if (uvLvlEl) uvLvlEl.textContent = uvVal >= 11 ? "Extreme" : uvVal >= 8 ? "Very High" : uvVal >= 6 ? "High" : uvVal >= 3 ? "Moderate" : "Low";
    if (uvDescEl) uvDescEl.textContent = uvVal >= 8 ? "Apply SPF 50+ sunscreen" : uvVal >= 3 ? "Wear a sun hat when going out" : "No protection required";

    // Feels Like
    const feels = formatTemp(current.apparent_temperature);
    const actual = formatTemp(current.temperature_2m);
    const feelsEl = document.getElementById("feels-val");
    const feelsActualEl = document.getElementById("feels-actual");
    const feelsDescEl = document.getElementById("feels-desc");
    if (feelsEl) feelsEl.textContent = feels;
    if (feelsActualEl) feelsActualEl.textContent = `Actual temperature: ${actual}`;
    if (feelsDescEl) {
        const diff = current.apparent_temperature - current.temperature_2m;
        feelsDescEl.textContent = diff > 2 ? "Feels hotter than the actual temperature"
            : diff < -2 ? "Feels cooler than the actual temperature"
            : "Feels close to the actual temperature";
    }

    // Wind
    const windSpeedRaw = current.wind_speed_10m;
    const windSpeedFormatted = formatWind(windSpeedRaw);
    const windDir = current.wind_direction_10m;
    const windEl = document.getElementById("wind-val");
    const windUnitEl = document.querySelector(".wind-number .unit");
    const compassEl = document.getElementById("compass-needle");
    const windDescEl = document.getElementById("wind-desc");
    if (windEl) windEl.textContent = windSpeedFormatted;
    if (windUnitEl) windUnitEl.textContent = getWindUnitLabel();
    if (compassEl) compassEl.style.transform = `rotate(${windDir}deg)`;
    if (windDescEl) {
        const speedInKmh = windSpeedRaw;
        windDescEl.textContent = speedInKmh < 1 ? "Calm" : speedInKmh < 12 ? "Light breeze" : speedInKmh < 29 ? "Moderate breeze" : speedInKmh < 50 ? "Fresh breeze" : "Strong wind";
    }

    // Sunset / Sunrise
    if (daily.sunrise && daily.sunset) {
        const sunriseTime = new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const sunsetTime = new Date(daily.sunset[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        const sunsetEl = document.getElementById("sunset-val");
        const sunriseEl = document.getElementById("sunrise-val");
        if (sunsetEl) sunsetEl.textContent = sunsetTime.toLowerCase();
        if (sunriseEl) sunriseEl.textContent = `Sunrise: ${sunriseTime.toLowerCase()}`;
    }

    // Humidity
    const humidity = current.relative_humidity_2m;
    const humEl = document.getElementById("humidity-val");
    const humDescEl = document.getElementById("humidity-desc");
    if (humEl) humEl.textContent = `${humidity} %`;
    if (humDescEl) humDescEl.textContent = humidity >= 80 ? "Feels very stuffy" : humidity >= 60 ? "Feels a bit stuffy" : humidity >= 40 ? "Comfortable humidity" : "Dry air today";

    // Pressure
    const pressure = Math.round(current.surface_pressure);
    const pressEl = document.getElementById("pressure-val");
    const pressDescEl = document.getElementById("pressure-desc");
    if (pressEl) pressEl.textContent = `${pressure} hPa`;
    if (pressDescEl) pressDescEl.textContent = pressure > 1020 ? "High pressure — fair weather" : pressure < 1000 ? "Low pressure — unsettled weather" : "Normal air pressure";

    // Visibility
    const currentHourStr = data.current.time.substring(0, 13);
    const visIdx = Math.max(0, (data.hourly.time || []).findIndex(t => t.startsWith(currentHourStr)));
    if (data.hourly && Array.isArray(data.hourly.visibility) && typeof data.hourly.visibility[visIdx] === "number") {
        const visKm = (data.hourly.visibility[visIdx] / 1000).toFixed(1);
        const visEl = document.getElementById("visibility-val");
        const visDescEl = document.getElementById("visibility-desc");
        const visMarker = document.getElementById("visibility-marker");
        if (visEl) visEl.textContent = `${visKm} km`;
        if (visDescEl) visDescEl.textContent = parseFloat(visKm) >= 10 ? "Excellent visibility" : parseFloat(visKm) >= 5 ? "Good visibility" : parseFloat(visKm) >= 1 ? "Moderate visibility" : "Poor visibility — fog possible";
        if (visMarker) visMarker.style.left = `${Math.min(100, (parseFloat(visKm) / 24) * 100)}%`;
    }
}

function updateLifestyle(data) {
    const current = data.current;
    const temp = current.temperature_2m;
    const code = current.weather_code;
    const wind = current.wind_speed_10m;

    const fishingEl = document.getElementById("fishing-desc");
    const clothingEl = document.getElementById("clothing-desc");
    const healthEl = document.getElementById("health-desc");
    const starEl = document.getElementById("star-desc");

    // 1. Fishing Logic
    if (fishingEl) {
        if (code >= 95 || wind > 30) {
            fishingEl.textContent = "Storm/High wind — Avoid open water";
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) {
            fishingEl.textContent = "Precipitation — Not ideal for fishing";
        } else if (temp > 10 && temp < 30 && code <= 3) {
            fishingEl.textContent = "Good fishing conditions today!";
        } else {
            fishingEl.textContent = "Fair conditions for fishing";
        }
    }

    // 2. Clothing Logic (Based on Temperature)
    if (clothingEl) {
        if (temp < 0) {
            clothingEl.textContent = "Freezing! Heavy thermal layers needed";
        } else if (temp < 10) {
            clothingEl.textContent = "Cold — Winter coat and gloves recommended";
        } else if (temp < 18) {
            clothingEl.textContent = "Cool — A light jacket or sweater is good";
        } else if (temp < 26) {
            clothingEl.textContent = "Warm — T-shirt and light clothing are fine";
        } else {
            clothingEl.textContent = "Hot! Wear light, breathable fabrics";
        }
    }

    // 3. Health & Outdoor Safety Logic
    if (healthEl) {
        if (code >= 95) {
            healthEl.textContent = "Thunderstorm — Stay indoors if possible";
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
            healthEl.textContent = "Rainy — Carry an umbrella to stay dry";
        } else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
            healthEl.textContent = "Snowing — Dress warm and watch your step";
        } else if (wind > 35) {
            healthEl.textContent = "High winds — Protect eyes and skin";
        } else if (code === 45 || code === 48) {
            healthEl.textContent = "Foggy — Low visibility, take care traveling";
        } else {
            healthEl.textContent = "Comfortable outdoor conditions today";
        }
    }

    // 4. Stargazing Logic
    if (starEl) {
        if (code === 0) {
            starEl.textContent = "Clear skies — Perfect for stargazing!";
        } else if (code === 1 || code === 2) {
            starEl.textContent = "Partly cloudy — Some stars will be visible";
        } else {
            starEl.textContent = "Too cloudy — Poor visibility for stars";
        }
    }
}
function getWeatherDescription(code) {
    const descriptions = {
        0:  "Clear sky",
        1:  "Mainly clear",
        2:  "Partly cloudy",
        3:  "Overcast",
        45: "Fog",
        48: "Icy fog",
        51: "Light drizzle",
        53: "Drizzle",
        55: "Heavy drizzle",
        56: "Light freezing drizzle",
        57: "Freezing drizzle",
        61: "Light rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Freezing rain",
        71: "Light snowfall",
        73: "Moderate snowfall",
        75: "Heavy snowfall",
        77: "Snow grains",
        80: "Light showers",
        81: "Moderate showers",
        82: "Violent showers",
        85: "Light snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Thunderstorm with heavy hail"
    };
    return descriptions[code] ?? "Fair";
}

function getWeatherIcon(code) {
    if (code === 0)                        return "☀️";
    if (code === 1 || code === 2)          return "⛅";
    if (code === 3)                        return "☁️";
    if (code === 45 || code === 48)        return "🌫️";
    if (code >= 51 && code <= 57)          return "🌦️";
    if (code >= 61 && code <= 67)          return "🌧️";
    if (code >= 71 && code <= 77)          return "❄️";
    if (code >= 80 && code <= 82)          return "🌧️";
    if (code === 85 || code === 86)        return "🌨️";
    if (code >= 95)                        return "⛈️";
    return "🌤️";
}

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

function setWindUnit(unit) {
    if (unit !== "km/h" && unit !== "mph") return;
    appSettings.windUnit = unit;
    saveSettings();
    rerenderFromCache();
    syncWindUnitControls();
}

function syncWindUnitControls() {
    const unit = appSettings.windUnit;
    const kmhEl = document.getElementById("windunit-kmh");
    const mphEl = document.getElementById("windunit-mph");
    if (kmhEl) kmhEl.checked = unit === "km/h";
    if (mphEl) mphEl.checked = unit === "mph";
}

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
    if (freq === "manual") return;

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

let systemThemeMediaQuery = null;

function applyTheme() {
    const theme = appSettings.appearance.theme;
    const effectiveTheme = theme === "system" ? getSystemTheme() : theme;
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.setAttribute(
        "data-reduce-animations",
        appSettings.appearance.reduceAnimations ? "true" : "false"
    );

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

const WEATHER_BACKGROUNDS = {
    clear: { 
        // Matches the bright sun flare effect
        day: "radial-gradient(circle at 30% 20%, #fdfbfb 0%, #51a6fb 25%, #1972d3 100%)", 
        night: "linear-gradient(180deg, #091424 0%, #173259 100%)" 
    },
    cloudy: { 
        // Matches the overcast/grey-blue look
        day: "linear-gradient(180deg, #6c7c8c 0%, #9baab8 100%)", 
        night: "linear-gradient(180deg, #243242 0%, #3a4c5e 100%)" 
    },
    rain: { 
        // Matches the deep, dark stormy blue
        day: "linear-gradient(180deg, #2b394a 0%, #4c627a 100%)", 
        night: "linear-gradient(180deg, #182230 0%, #2b394a 100%)" 
    },
    snow: { 
        day: "linear-gradient(180deg, #a5b5c4 0%, #dbe2e8 100%)", 
        night: "linear-gradient(180deg, #2c3642 0%, #151a21 100%)" 
    },
    storm: { 
        day: "linear-gradient(180deg, #1b202e 0%, #384259 100%)", 
        night: "linear-gradient(180deg, #0f121a 0%, #1b202e 100%)" 
    },
    fog: { 
        day: "linear-gradient(180deg, #8b96a0 0%, #b8c1c9 100%)", 
        night: "linear-gradient(180deg, #2c343b 0%, #1a1e24 100%)" 
    }
};

function applyWeatherVisuals() {
    if (particleIntervalId) {
        clearInterval(particleIntervalId);
        particleIntervalId = null;
    }
    const particlesContainer = document.getElementById("particles-container");
    const skyVisuals = document.getElementById("sky-visuals");
    
    if (particlesContainer) particlesContainer.innerHTML = "";
    if (skyVisuals) skyVisuals.innerHTML = "";

    if (!lastWeatherData) return;

    const code = lastWeatherData.current.weather_code;
    const isDay = lastWeatherData.current.is_day !== 0;
    const category = classifyWeatherCode(code);

    // App Background Gradient
    const bgEl = document.getElementById("weather-bg");
    if (bgEl) {
        if (appSettings.appearance.animatedBackground) {
            const variant = WEATHER_BACKGROUNDS[category] || WEATHER_BACKGROUNDS.clear;
            bgEl.style.background = isDay ? variant.day : variant.night;
        } else {
            bgEl.style.background = ""; 
        }
    }

    // Render Sun/Moon and Clouds inside the App Header Box
    if (skyVisuals) {
        const celestial = document.createElement("div");
        celestial.className = "celestial-body";
        celestial.textContent = isDay ? "☀️" : "🌕";
        skyVisuals.appendChild(celestial);

        if (category === "cloudy" || category === "rain" || category === "storm" || category === "fog" || category === "snow") {
            for (let i = 0; i < 2; i++) {
                const cloud = document.createElement("div");
                cloud.className = "cloud-layer";
                cloud.style.top = `${15 + (i * 35)}%`;
                cloud.style.width = `${160 + Math.random() * 80}px`;
                cloud.style.height = `${40 + Math.random() * 20}px`;
                cloud.style.animationDuration = `${18 + (i * 8)}s`;
                cloud.style.animationDelay = `-${i * 5}s`;
                cloud.style.opacity = isDay ? "0.35" : "0.2";
                skyVisuals.appendChild(cloud);
            }
        }
    }

    if (!appSettings.appearance.weatherAnimation || !particlesContainer) return;

    // Render falling precipitation across the screen if raining/snowing
    if (category === "rain" || category === "storm") {
        const maxParticles = appSettings.appearance.reduceAnimations ? 12 : 35;
        for (let i = 0; i < maxParticles; i++) {
            const particle = document.createElement("div");
            particle.className = "rain-particle";
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${-20 - (Math.random() * 40)}px`;
            const duration = 0.4 + Math.random() * 0.3;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${Math.random() * 2}s`;
            particlesContainer.appendChild(particle);
        }
    } else if (category === "snow") {
        const maxParticles = appSettings.appearance.reduceanimations ? 12 : 30;
        for (let i = 0; i < maxParticles; i++) {
            const particle = document.createElement("div");
            particle.className = "snow-particle";
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${-20 - (Math.random() * 40)}px`;
            const duration = 2 + Math.random() * 2;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${Math.random() * 3}s`;
            particlesContainer.appendChild(particle);
        }
    }
}
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
        const wHourStr = data.current.time.substring(0, 13);
        const wIdx = Math.max(0, data.hourly.time.findIndex(t => t.startsWith(wHourStr)));
        rowItems.push(`${data.hourly.precipitation_probability[wIdx] || 0}% rain`);
    }
    if (w.showWind) {
        rowItems.push(`${formatWind(current.wind_speed_10m)} ${getWindUnitLabel()} wind`);
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

    let visibleParts = parts;
    if (w.style === "compact") visibleParts = parts.slice(0, 2);
    else if (w.style === "standard") visibleParts = parts.slice(0, 3);

    preview.innerHTML = visibleParts.join("") || `<div class="row-note">Nothing selected to show</div>`;
}

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

    document.addEventListener("click", (e) => {
        if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== menuBtn) {
            closeMenu();
        }
    });

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
    ALL_PANEL_IDS.forEach((id) => {
        const overlay = document.getElementById(id);
        if (!overlay) return;
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closePanel(id);
        });
    });

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
    wireRadioListener("windunit-kmh", () => setWindUnit("km/h"));
    wireRadioListener("windunit-mph", () => setWindUnit("mph"));
}

function wireFrequencyPanel() {
    Object.keys(FREQ_RADIO_MAP).forEach((id) => {
        wireRadioListener(id, () => setUpdateFrequency(FREQ_RADIO_MAP[id]));
    });
}

function wireSettingsPanel() {
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

    WEATHER_INFO_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.weatherInformation[field] = val;
            saveSettings();
            rerenderFromCache();
        });
    });

    NOTIF_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.notifications[field] = val;
            saveSettings();
        });
    });

    LOCATION_TOGGLE_FIELDS.forEach(([id, field]) => {
        wireToggleListener(id, (val) => {
            appSettings.location[field] = val;
            saveSettings();
        });
    });

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

function populateSettingsControls() {
    syncTempUnitControls();
    syncWindUnitControls();

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

function clearCachedWeatherData() {
    lastWeatherData = null;
    fetchWeatherData(currentLat, currentLon, currentCityName);
}

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
