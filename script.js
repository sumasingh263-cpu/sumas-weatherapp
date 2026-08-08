// script.js - Core functionality for WeatherNow
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const AQI_API = "https://air-quality-api.open-meteo.com/v1/air-quality";

// DOM References
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions-list');
const currentLocBtn = document.getElementById('current-loc-btn');
const errorBanner = document.getElementById('error-banner');
const loadingScreen = document.getElementById('loading-screen');
const weatherBg = document.getElementById('weather-bg');
const sunMoonGlow = document.getElementById('sun-moon-glow');
const particlesContainer = document.getElementById('particles-container');

// UI Fields
const locationTitle = document.getElementById('location-title');
const weatherCondition = document.getElementById('weather-condition');
const tempDisplay = document.getElementById('temp-display');
const highLowDisplay = document.getElementById('high-low-display');
const hourlyScroll = document.getElementById('hourly-scroll');
const forecastList = document.getElementById('forecast-list');

const aqiValue = document.getElementById('aqi-value');
const aqiBadge = document.getElementById('aqi-badge');
const aqiRecommendation = document.getElementById('aqi-recommendation');
const pm25Val = document.getElementById('pm25-val');
const pm10Val = document.getElementById('pm10-val');
const o3Val = document.getElementById('o3-val');
const no2Val = document.getElementById('no2-val');

const clothingGrid = document.getElementById('clothing-grid');
const uvVal = document.getElementById('uv-val');
const uvDesc = document.getElementById('uv-desc');
const feelsVal = document.getElementById('feels-val');
const feelsDesc = document.getElementById('feels-desc');
const windVal = document.getElementById('wind-val');
const windDesc = document.getElementById('wind-desc');
const sunriseVal = document.getElementById('sunrise-val');
const sunsetVal = document.getElementById('sunset-val');
const humidityVal = document.getElementById('humidity-val');
const visVal = document.getElementById('vis-val');
const pressureVal = document.getElementById('pressure-val');
const moonIcon = document.getElementById('moon-icon');
const moonName = document.getElementById('moon-name');

// Default Load on Startup (Rantasalmi, Finland)
window.addEventListener('DOMContentLoaded', () => {
    fetchWeatherData(62.22, 28.33, "Rantasalmi", "Finland");
});

// Search Autocomplete
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
            fetchWeatherData(loc.latitude, loc.longitude, loc.name, loc.country);
        });
        suggestionsList.appendChild(li);
    });
}

// Current Location Button
currentLocBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => fetchWeatherData(pos.coords.latitude, pos.coords.longitude, "Current Location", ""),
            () => showError("Location permission denied or unavailable.")
        );
    }
});

async function fetchWeatherData(lat, lon, cityName, countryName) {
    loadingScreen.classList.remove('hidden');
    hideError();

    try {
        const weatherUrl = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        const aqiUrl = `${AQI_API}?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl).catch(() => null)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = aqiRes ? await aqiRes.json() : null;

        updateUI(weatherData, aqiData, cityName, countryName);
    } catch (err) {
        console.error("API error:", err);
        showError("Failed to fetch weather data. Please check your network.");
    } finally {
        loadingScreen.classList.add('hidden');
    }
}

function updateUI(w, aqi, cityName, countryName) {
    const current = w.current;
    const daily = w.daily;
    const hourly = w.hourly;
    const isDay = current.is_day === 1;

    // 1. Current Weather
    locationTitle.textContent = `📍 ${cityName}${countryName ? ', ' + countryName : ''}`;
    weatherCondition.textContent = getWeatherConditionText(current.weather_code);
    const temp = Math.round(current.temperature_2m);
    tempDisplay.textContent = `${temp}°`;
    highLowDisplay.textContent = `High: ${Math.round(daily.temperature_2m_max[0])}°  |  Low: ${Math.round(daily.temperature_2m_min[0])}°`;

    // Background & Theme
    const theme = getWeatherTheme(current.weather_code, isDay);
    weatherBg.className = `weather-bg ${theme}`;
    if (theme.includes('Day') || theme === 'clearDay') {
        sunMoonGlow.className = 'sun-glow';
    } else if (theme === 'clearNight') {
        sunMoonGlow.className = 'moon-glow';
    } else {
        sunMoonGlow.className = '';
    }
    renderParticles(theme);

    // 2. Hourly Weather
    hourlyScroll.innerHTML = "";
    const nowIdx = hourly.time.findIndex(t => new Date(t) >= new Date()) || 0;
    for (let i = nowIdx; i < Math.min(nowIdx + 24, hourly.time.length); i++) {
        const hDiv = document.createElement('div');
        hDiv.className = 'hourly-item';
        hDiv.innerHTML = `
            <span class="hour-time">${i === nowIdx ? "Now" : formatHour(hourly.time[i])}</span>
            <span class="hour-icon">${hourly.is_day[i] === 1 ? '☀️' : '🌙'}</span>
            <span class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</span>
        `;
        hourlyScroll.appendChild(hDiv);
    }

    // 3. 7-Day Forecast
    forecastList.innerHTML = "";
    daily.time.forEach((dateStr, i) => {
        const minT = Math.round(daily.temperature_2m_min[i]);
        const maxT = Math.round(daily.temperature_2m_max[i]);
        const barWidth = Math.max(25, (maxT - minT) * 10);
        
        const fRow = document.createElement('div');
        fRow.className = 'forecast-row';
        fRow.innerHTML = `
            <span class="forecast-day">${i === 0 ? "Today" : formatDayName(dateStr)}</span>
            <span class="forecast-icon">☁️</span>
            <div class="forecast-range">
                <span>${minT}°</span>
                <div class="temp-bar-bg"><div class="temp-bar-fill" style="width: ${barWidth}%"></div></div>
                <span>${maxT}°</span>
            </div>
        `;
        forecastList.appendChild(fRow);
    });

    // 5. Air Quality (AQI)
    const aqiVal = aqi?.current?.european_aqi || 42;
    const aqiMeta = getAQIMeta(aqiVal);
    aqiValue.textContent = aqiVal;
    aqiBadge.textContent = aqiMeta.category;
    aqiBadge.style.background = aqiMeta.color;
    aqiRecommendation.textContent = aqiMeta.rec;
    pm25Val.textContent = `${aqi?.current?.pm2_5 || 8} µg/m³`;
    pm10Val.textContent = `${aqi?.current?.pm10 || 15} µg/m³`;
    o3Val.textContent = `${aqi?.current?.ozone || 52} µg/m³`;
    no2Val.textContent = `${aqi?.current?.nitrogen_dioxide || 12} µg/m³`;

    // 6. Clothing Recommendation Engine
    renderClothing({
        temp,
        wind: current.wind_speed_10m,
        rain: current.precipitation,
        uv: daily.uv_index_max[0] || 0,
        weatherCode: current.weather_code
    });

    // 4. Details Cards
    const uv = daily.uv_index_max[0] || 0;
    uvVal.textContent = uv;
    uvDesc.textContent = uv <= 2 ? "Almost no risk of sunburn" : "Sun protection recommended";

    const feels = Math.round(current.apparent_temperature);
    feelsVal.textContent = `${feels}°`;
    feelsDesc.textContent = feels < temp ? "Feels colder than actual temp" : "Feels comfortable";

    windVal.textContent = `${current.wind_speed_10m} m/s`;
    windDesc.textContent = `Wind direction ${getWindDir(current.wind_direction_10m)}`;

    sunriseVal.textContent = `Rise: ${formatTime(daily.sunrise[0])}`;
    sunsetVal.textContent = `Set: ${formatTime(daily.sunset[0])}`;

    humidityVal.textContent = `${current.relative_humidity_2m}%`;
    visVal.textContent = `25 km`;
    pressureVal.textContent = `${Math.round(current.pressure_msl || 1013)} hPa`;

    moonIcon.textContent = "🌘";
    moonName.textContent = "Waning Crescent";
}

function renderParticles(theme) {
    particlesContainer.innerHTML = "";
    let count = 0;
    if (theme === 'rain' || theme === 'heavyRain') count = 35;
    else if (theme === 'snow') count = 30;
    else if (theme === 'clearNight') count = 25;

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = `particle ${theme === 'snow' ? 'snow-flake' : theme.includes('rain') ? 'rain-drop' : 'star'}`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 2 + 1}s`;
        p.style.animationDelay = `${Math.random() * 2}s`;
        const size = Math.random() * 3 + 1;
        p.style.width = `${size}px`;
        p.style.height = `${theme.includes('rain') ? size * 8 : size}px`;
        particlesContainer.appendChild(p);
    }
}

function renderClothing(data) {
    clothingGrid.innerHTML = "";
    const items = [];
    if (data.temp < 0) {
        items.push({ icon: "🧥", label: "Heavy Winter Coat" }, { icon: "🧣", label: "Scarf & Gloves" }, { icon: "🥾", label: "Snow Boots" });
    } else if (data.temp < 12) {
        items.push({ icon: "🧥", label: "Warm Jacket" }, { icon: "👕", label: "Sweater / Hoodie" }, { icon: "👖", label: "Trousers" });
    } else if (data.temp < 20) {
        items.push({ icon: "🧥", label: "Light Jacket" }, { icon: "👕", label: "T-Shirt / Long Sleeve" });
    } else {
        items.push({ icon: "👕", label: "Light T-Shirt" }, { icon: "🩳", label: "Shorts or Light Pants" }, { icon: "🧢", label: "Cap" });
    }

    if (data.rain > 0 || [51,53,55,61,63,65].includes(data.weatherCode)) {
        items.push({ icon: "☔", label: "Umbrella & Waterproof Coat" });
    }
    if (data.wind > 20) {
        items.push({ icon: "💨", label: "Windbreaker Layer" });
    }
    if (data.uv >= 6) {
        items.push({ icon: "🕶️", label: "Sunglasses & Sunscreen" });
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'clothing-item';
        div.innerHTML = `<span class="clothing-icon">${item.icon}</span><span class="clothing-label">${item.label}</span>`;
        clothingGrid.appendChild(div);
    });
}

function getWeatherTheme(code, isDay) {
    if (code === 0) return isDay ? "clearDay" : "clearNight";
    if (code === 1 || code === 2) return isDay ? "partlyCloudyDay" : "partlyCloudyNight";
    if (code === 3) return "cloudy";
    if ([51,53,55,61,63].includes(code)) return "rain";
    if ([65,80,81,82].includes(code)) return "heavyRain";
    if ([71,73,75,85].includes(code)) return "snow";
    if ([95,96,99].includes(code)) return "thunderstorm";
    if ([45,48].includes(code)) return "fog";
    return isDay ? "clearDay" : "clearNight";
}

function getWeatherConditionText(code) {
    const map = {
        0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 51: "Light Drizzle", 61: "Slight Rain", 63: "Moderate Rain",
        65: "Heavy Rain", 71: "Snow", 95: "Thunderstorm"
    };
    return map[code] || "Clear";
}

function getAQIMeta(aqi) {
    if (aqi <= 20) return { category: "Good", color: "#10B981", rec: "Air quality is good. Outdoor activities are fully suitable." };
    if (aqi <= 40) return { category: "Fair", color: "#34D399", rec: "Air quality is acceptable for most people." };
    if (aqi <= 60) return { category: "Moderate", color: "#FBBF24", rec: "Sensitive individuals should avoid prolonged exertion." };
    if (aqi <= 80) return { category: "Poor", color: "#F97316", rec: "Unhealthy for sensitive groups. Consider reducing outdoor time." };
    return { category: "Hazardous", color: "#EF4444", rec: "Very poor air quality. Limit outdoor activities." };
}

function formatHour(iso) { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', hour12: true }).toLowerCase(); }
function formatDayName(iso) { return new Date(iso).toLocaleDateString([], { weekday: 'short' }); }
function formatTime(iso) { return !iso ? "--:--" : new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(); }
function getWindDir(deg) {
    if (deg === undefined) return "N";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round((deg % 360) / 45) % 8];
}
function showError(msg) { errorBanner.textContent = msg; errorBanner.classList.remove('hidden'); }
function hideError() { errorBanner.classList.add('hidden'); }
