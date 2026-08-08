// script.js - Core logic matching screenshot layout
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

const cityTitle = document.getElementById('city-title');
const locationToggleBtn = document.getElementById('location-toggle-btn');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions-list');
const currentLocBtn = document.getElementById('current-loc-btn');
const errorBanner = document.getElementById('error-banner');
const loadingScreen = document.getElementById('loading-screen');
const weatherBg = document.getElementById('weather-bg');
const sunMoonGlow = document.getElementById('sun-moon-glow');

const tempDisplay = document.getElementById('temp-display');
const highLowDisplay = document.getElementById('high-low-display');
const weatherCondition = document.getElementById('weather-condition');
const hourlyScroll = document.getElementById('hourly-scroll');
const forecastList = document.getElementById('forecast-list');

const uvLevel = document.getElementById('uv-level');
const uvNum = document.getElementById('uv-num');
const uvDesc = document.getElementById('uv-desc');
const uvBarFill = document.getElementById('uv-bar-fill');

const feelsVal = document.getElementById('feels-val');
const feelsActual = document.getElementById('feels-actual');
const feelsDesc = document.getElementById('feels-desc');

const windSpeedVal = document.getElementById('wind-speed-val');
const windDesc = document.getElementById('wind-desc');

const sunriseVal = document.getElementById('sunrise-val');
const sunsetVal = document.getElementById('sunset-val');

const humidityVal = document.getElementById('humidity-val');
const humidityDesc = document.getElementById('humidity-desc');

const visVal = document.getElementById('vis-val');
const visDesc = document.getElementById('vis-desc');

const pressureVal = document.getElementById('pressure-val');
const pressureDesc = document.getElementById('pressure-desc');

const moonIcon = document.getElementById('moon-icon');
const moonName = document.getElementById('moon-name');
const moonsetVal = document.getElementById('moonset-val');

const lifeFishing = document.getElementById('life-fishing');
const lifeClothing = document.getElementById('life-clothing');
const lifeHealth = document.getElementById('life-health');
const lifeStargazing = document.getElementById('life-stargazing');

locationToggleBtn.addEventListener('click', () => {
    searchContainer.classList.toggle('hidden');
});

window.addEventListener('DOMContentLoaded', () => {
    fetchWeatherData(62.22, 28.33, "Rantasalmi");
});

let searchTimer;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    if (query.length < 2) {
        suggestionsList.innerHTML = "";
        return;
    }
    searchTimer = setTimeout(async () => {
        try {
            const res = await fetch(`${GEO_API}?name=${encodeURIComponent(query)}&count=5&format=json`);
            const data = await res.json();
            renderSuggestions(data.results || []);
        } catch (err) {
            console.error("Search error:", err);
        }
    }, 300);
});

function renderSuggestions(results) {
    suggestionsList.innerHTML = "";
    results.forEach(loc => {
        const li = document.createElement('li');
        li.textContent = `${loc.name}, ${loc.country || loc.admin1 || ''}`;
        li.addEventListener('click', () => {
            suggestionsList.innerHTML = "";
            searchInput.value = "";
            searchContainer.classList.add('hidden');
            fetchWeatherData(loc.latitude, loc.longitude, loc.name);
        });
        suggestionsList.appendChild(li);
    });
}

currentLocBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                searchContainer.classList.add('hidden');
                fetchWeatherData(pos.coords.latitude, pos.coords.longitude, "Current Location");
            },
            () => showError("Location permission denied.")
        );
    }
});

async function fetchWeatherData(lat, lon, cityName) {
    loadingScreen.classList.remove('hidden');
    hideError();

    try {
        const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        updateUI(data, cityName);
    } catch (err) {
        console.error("API error:", err);
        showError("Failed to fetch weather data.");
    } finally {
        loadingScreen.classList.add('hidden');
    }
}

function updateUI(w, cityName) {
    const current = w.current;
    const daily = w.daily;
    const hourly = w.hourly;
    const isDay = current.is_day === 1;

    cityTitle.textContent = cityName;
    const temp = Math.round(current.temperature_2m);
    tempDisplay.textContent = `${temp}°`;
    highLowDisplay.textContent = `High: ${Math.round(daily.temperature_2m_max[0])}° Low: ${Math.round(daily.temperature_2m_min[0])}°`;
    weatherCondition.textContent = getWeatherConditionText(current.weather_code);

    const theme = getWeatherTheme(current.weather_code, isDay);
    weatherBg.className = `weather-bg ${theme}`;
    sunMoonGlow.className = isDay ? 'sun-glow' : 'moon-glow';

    // Hourly
    hourlyScroll.innerHTML = "";
    const nowIdx = hourly.time.findIndex(t => new Date(t) >= new Date()) || 0;
    for (let i = nowIdx; i < Math.min(nowIdx + 8, hourly.time.length); i++) {
        const hDiv = document.createElement('div');
        hDiv.className = 'hourly-item';
        hDiv.innerHTML = `
            <span class="hour-time">${i === nowIdx ? "Now" : formatHour(hourly.time[i])}</span>
            <span class="hour-icon">${hourly.is_day[i] === 1 ? '☀️' : '🌙'}</span>
            <span class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</span>
        `;
        hourlyScroll.appendChild(hDiv);
    }

    // Forecast
    forecastList.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        if (!daily.time[i]) break;
        const minT = Math.round(daily.temperature_2m_min[i]);
        const maxT = Math.round(daily.temperature_2m_max[i]);
        const barWidth = Math.max(30, (maxT - minT) * 12);
        
        const fRow = document.createElement('div');
        fRow.className = 'forecast-row';
        fRow.innerHTML = `
            <span class="forecast-day">${i === 0 ? "Today" : formatDayName(daily.time[i])}</span>
            <div class="forecast-icon-wrap"><span>⛅</span></div>
            <div class="forecast-range">
                <span>${minT}°</span>
                <div class="temp-bar-bg"><div class="temp-bar-fill" style="width: ${barWidth}%"></div></div>
                <span>${maxT}°</span>
            </div>
        `;
        forecastList.appendChild(fRow);
    }

    // Details Cards
    const uv = daily.uv_index_max[0] || 1;
    uvNum.textContent = uv;
    uvLevel.textContent = uv <= 2 ? "Low" : uv <= 5 ? "Moderate" : "High";
    uvDesc.textContent = uv <= 2 ? "Almost no risk of sunburn" : "Sun protection recommended";
    uvBarFill.style.width = `${Math.min(100, uv * 15)}%`;

    const feels = Math.round(current.apparent_temperature);
    feelsVal.textContent = `${feels}°`;
    feelsActual.textContent = `Actual temperature: ${temp}°`;
    feelsDesc.textContent = feels < temp ? "Feels a bit colder than the actual temperature" : "Feels comfortable and warm";

    const windSpeed = current.wind_speed_10m || 2;
    const bft = Math.round(windSpeed / 2.5) + 1;
    windSpeedVal.textContent = `${bft} Bft`;
    windDesc.textContent = `${getWindDir(current.wind_direction_10m)} wind, gentle breeze on the face`;

    sunriseVal.textContent = formatTime(daily.sunrise[0]);
    sunsetVal.textContent = `Sunset: ${formatTime(daily.sunset[0])}`;

    const hum = current.relative_humidity_2m || 66;
    humidityVal.textContent = `${hum} %`;
    humidityDesc.textContent = hum > 70 ? "Fairly humid, drying will take longer" : "Comfortable humidity levels";

    visVal.textContent = "30 km";
    visDesc.textContent = "Excellent visibility";

    const press = Math.round(current.pressure_msl || 1011);
    pressureVal.textContent = press;
    pressureDesc.textContent = "Normal air pressure, comfortable weather";

    moonIcon.textContent = "🌕";
    moonName.textContent = "Waning crescent";
    moonsetVal.textContent = "9.06 pm Moonset";

    lifeFishing.textContent = temp > 5 && temp < 25 ? "Good conditions for fishing" : "Not ideal fishing";
    lifeClothing.textContent = temp < 15 ? "Light jacket recommended" : "T-shirt weather";
    lifeHealth.textContent = temp < 10 ? "Very high chance of getting a cold" : "Low health risk";
    lifeStargazing.textContent = current.weather_code === 0 ? "Perfect conditions for stargazing" : "Fairly suitable for stargazing";
}

function getWeatherTheme(code, isDay) {
    if (code === 0) return isDay ? "clearDay" : "clearNight";
    if (code === 1 || code === 2) return isDay ? "partlyCloudyDay" : "partlyCloudyNight";
    if (code === 3) return "cloudy";
    if ([51,53,55,61,63].includes(code)) return "rain";
    if ([65,80,81,82].includes(code)) return "heavyRain";
    if ([71,73,75,85].includes(code)) return "snow";
    if ([95,96,99].includes(code)) return "thunderstorm";
    return isDay ? "clearDay" : "clearNight";
}

function getWeatherConditionText(code) {
    const map = { 0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast", 45: "Foggy", 61: "Rain", 71: "Snow", 95: "Thunderstorm" };
    return map[code] || "Clear";
}

function formatHour(iso) { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', hour12: true }).toLowerCase(); }
function formatDayName(iso) { return new Date(iso).toLocaleDateString([], { weekday: 'short' }); }
function formatTime(iso) { return !iso ? "--:--" : new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(); }
function getWindDir(deg) {
    if (deg === undefined) return "W";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round((deg % 360) / 45) % 8];
}
function showError(msg) { errorBanner.textContent = msg; errorBanner.classList.remove('hidden'); }
function hideError() { errorBanner.classList.add('hidden'); }
                                                 
