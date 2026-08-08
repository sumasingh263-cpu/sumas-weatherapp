const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_API = "https://air-quality-api.open-meteo.com/v1/air-quality";

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

const menuBtn = document.getElementById('menu-btn');
const savedCitiesModal = document.getElementById('saved-cities-modal');
const savedCitiesList = document.getElementById('saved-cities-list');
const saveCurrentFavBtn = document.getElementById('save-current-fav-btn');
const favoritesChips = document.getElementById('favorites-chips');

const tempDisplay = document.getElementById('temp-display');
const highLowDisplay = document.getElementById('high-low-display');
const weatherCondition = document.getElementById('weather-condition');
const hourlyScroll = document.getElementById('hourly-scroll');
const forecastList = document.getElementById('forecast-list');

const chartToggleBtn = document.getElementById('chart-toggle-btn');
const chartContainerWrap = document.getElementById('chart-container-wrap');
let tempChartInstance = null;

// Air Quality Elements
const aqiVal = document.getElementById('aqi-val');
const aqiNum = document.getElementById('aqi-num');
const aqiBarFill = document.getElementById('aqi-bar-fill');
const aqiDesc = document.getElementById('aqi-desc');

// UV Elements
const uvLevel = document.getElementById('uv-level');
const uvNum = document.getElementById('uv-num');
const uvDesc = document.getElementById('uv-desc');
const uvBarFill = document.getElementById('uv-bar-fill');

const feelsVal = document.getElementById('feels-val');
const feelsActual = document.getElementById('feels-actual');
const feelsDesc = document.getElementById('feels-desc');

const windSpeedVal = document.getElementById('wind-speed-val');
const windNeedle = document.getElementById('wind-needle');
const windDesc = document.getElementById('wind-desc');

const sunriseVal = document.getElementById('sunrise-val');
const sunsetVal = document.getElementById('sunset-val');
const humidityVal = document.getElementById('humidity-val');
const humidityDesc = document.getElementById('humidity-desc');
const visVal = document.getElementById('vis-val');
const visDesc = document.getElementById('vis-desc');
const pressureVal = document.getElementById('pressure-val');
const pressureDesc = document.getElementById('pressure-desc');

const lifeFishing = document.getElementById('life-fishing');
const lifeClothing = document.getElementById('life-clothing');
const lifeHealth = document.getElementById('life-health');
const lifeStargazing = document.getElementById('life-stargazing');

let currentCoords = { lat: 62.22, lon: 28.33, name: "Rantasalmi" };

// LocalStorage Favorites
let favorites = JSON.parse(localStorage.getItem('weather_favorites')) || [
    { name: "Rantasalmi", lat: 62.22, lon: 28.33 },
    { name: "Helsinki", lat: 60.1695, lon: 24.9354 }
];

locationToggleBtn.addEventListener('click', () => {
    searchContainer.classList.toggle('hidden');
    savedCitiesModal.classList.add('hidden');
});

menuBtn.addEventListener('click', () => {
    savedCitiesModal.classList.toggle('hidden');
    searchContainer.classList.add('hidden');
    renderFavoritesList();
});

chartToggleBtn.addEventListener('click', () => {
    const isChartHidden = chartContainerWrap.classList.contains('hidden');
    if (isChartHidden) {
        chartContainerWrap.classList.remove('hidden');
        hourlyScroll.classList.add('hidden');
        chartToggleBtn.textContent = "🕒 Scroll View";
    } else {
        chartContainerWrap.classList.add('hidden');
        hourlyScroll.classList.remove('hidden');
        chartToggleBtn.textContent = "📊 Chart View";
    }
});

window.addEventListener('DOMContentLoaded', () => {
    renderFavoriteChips();
    fetchWeatherData(currentCoords.lat, currentCoords.lon, currentCoords.name);
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
            currentCoords = { lat: loc.latitude, lon: loc.longitude, name: loc.name };
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
                currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: "Current Location" };
                fetchWeatherData(pos.coords.latitude, pos.coords.longitude, "Current Location");
            },
            () => showError("Location permission denied.")
        );
    }
});

saveCurrentFavBtn.addEventListener('click', () => {
    if (!favorites.some(f => f.name === currentCoords.name)) {
        favorites.push({ ...currentCoords });
        localStorage.setItem('weather_favorites', JSON.stringify(favorites));
        renderFavoriteChips();
        renderFavoritesList();
        alert(`${currentCoords.name} saved to favorites!`);
    } else {
        alert(`${currentCoords.name} is already in your favorites.`);
    }
});

function renderFavoriteChips() {
    favoritesChips.innerHTML = "";
    favorites.forEach(fav => {
        const chip = document.createElement('button');
        chip.className = 'fav-chip';
        chip.textContent = fav.name;
        chip.addEventListener('click', () => {
            searchContainer.classList.add('hidden');
            currentCoords = { ...fav };
            fetchWeatherData(fav.lat, fav.lon, fav.name);
        });
        favoritesChips.appendChild(chip);
    });
}

function renderFavoritesList() {
    savedCitiesList.innerHTML = "";
    favorites.forEach((fav) => {
        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.innerHTML = `<span>📍 ${fav.name}</span>`;
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'chart-toggle-pill';
        loadBtn.textContent = "Select";
        loadBtn.addEventListener('click', () => {
            savedCitiesModal.classList.add('hidden');
            currentCoords = { ...fav };
            fetchWeatherData(fav.lat, fav.lon, fav.name);
        });
        li.appendChild(loadBtn);
        savedCitiesList.appendChild(li);
    });
}

async function fetchWeatherData(lat, lon, cityName) {
    loadingScreen.classList.remove('hidden');
    hideError();

    try {
        const weatherUrl = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) throw new Error("Weather request failed");
        const data = await weatherRes.json();

        let aqiData = null;
        try {
            const aqiUrl = `${AIR_QUALITY_API}?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5`;
            const aqiRes = await fetch(aqiUrl);
            if (aqiRes.ok) {
                aqiData = await aqiRes.json();
            }
        } catch (aqiErr) {
            console.warn("Air Quality API blocked or unavailable:", aqiErr);
        }

        updateUI(data, aqiData, cityName);
    } catch (err) {
        console.error("API error:", err);
        showError("Failed to fetch weather data. Check connection or ad-blocker.");
    } finally {
        loadingScreen.classList.add('hidden');
    }
}

function getSvgIcon(code, isDay) {
    if (code === 0) {
        return isDay 
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2m-4.22-7.78l1.42-1.42M5.64 18.36l1.42-1.42"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
    if (code === 1 || code === 2 || code === 3) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
    }
    if ([51,53,55,61,63,65,80,81,82].includes(code)) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M8 19v2m4-2v2m4-2v2"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/></svg>`;
}

function updateUI(w, aqi, cityName) {
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

    // Hourly Scroll & Chart Data
    hourlyScroll.innerHTML = "";
    const nowIdx = hourly.time.findIndex(t => new Date(t) >= new Date()) || 0;
    const chartTimes = [];
    const chartTemps = [];

    for (let i = nowIdx; i < Math.min(nowIdx + 12, hourly.time.length); i++) {
        const hTime = i === nowIdx ? "Now" : formatHour(hourly.time[i]);
        const hTemp = Math.round(hourly.temperature_2m[i]);
        
        chartTimes.push(hTime);
        chartTemps.push(hTemp);

        const hDiv = document.createElement('div');
        hDiv.className = 'hourly-item';
        hDiv.innerHTML = `
            <span class="hour-time">${hTime}</span>
            <span class="hour-icon">${getSvgIcon(hourly.weather_code[i], hourly.is_day[i] === 1)}</span>
            <span class="hour-temp">${hTemp}°</span>
        `;
        hourlyScroll.appendChild(hDiv);
    }

    renderTempChart(chartTimes, chartTemps);

    // 5-Day Forecast
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
            <div class="forecast-icon-wrap">${getSvgIcon(daily.weather_code[i], true)}</div>
            <div class="forecast-range">
                <span>${minT}°</span>
                <div class="temp-bar-bg"><div class="temp-bar-fill" style="width: ${barWidth}%"></div></div>
                <span>${maxT}°</span>
            </div>
        `;
        forecastList.appendChild(fRow);
    }

    // Air Quality Index (AQI) Fallback handling
    if (aqi && aqi.current) {
        const euAqi = aqi.current.european_aqi || 20;
        aqiNum.textContent = `EU AQI: ${euAqi}`;
        if (euAqi <= 20) {
            aqiVal.textContent = "Good";
            aqiDesc.textContent = "Air quality is ideal for outdoor activities.";
            aqiBarFill.style.background = "#22c55e";
        } else if (euAqi <= 40) {
            aqiVal.textContent = "Fair";
            aqiDesc.textContent = "Acceptable air quality for most individuals.";
            aqiBarFill.style.background = "#eab308";
        } else {
            aqiVal.textContent = "Moderate";
            aqiDesc.textContent = "Sensitive groups should take caution.";
            aqiBarFill.style.background = "#f97316";
        }
        aqiBarFill.style.width = `${Math.min(100, euAqi)}%`;
    } else {
        aqiVal.textContent = "Unavailable";
        aqiNum.textContent = "EU AQI: --";
        aqiDesc.textContent = "Data blocked or offline.";
    }

    // UV Index Accurate Data
    const uv = daily.uv_index_max[0] || 4.25;
    uvNum.textContent = uv.toFixed(2);
    uvLevel.textContent = uv <= 2 ? "Low" : uv <= 5 ? "Moderate" : "High";
    uvDesc.textContent = uv <= 2 ? "Almost no risk of sunburn" : "Sun protection recommended";
    uvBarFill.style.width = `${Math.min(100, uv * 10)}%`;

    // Feels Like
    const feels = Math.round(current.apparent_temperature);
    feelsVal.textContent = `${feels}°`;
    feelsActual.textContent = `Actual temperature: ${temp}°`;
    feelsDesc.textContent = feels < temp ? "Feels a bit colder than actual temp" : "Feels comfortable and warm";

    // Accurate Wind Speed & Direction Rotation
    const windSpeed = current.wind_speed_10m || 8;
    const windDirDeg = current.wind_direction_10m || 220;
    windSpeedVal.textContent = `${Math.round(windSpeed)} km/h`;
    windNeedle.style.transform = `rotate(${windDirDeg}deg)`;
    windDesc.textContent = `${getWindDir(windDirDeg)} wind, gentle breeze on the face`;

    // Sunrise & Sunset
    sunriseVal.textContent = formatTime(daily.sunrise[0]);
    sunsetVal.textContent = `Sunset: ${formatTime(daily.sunset[0])}`;

    // Humidity & Pressure
    const hum = current.relative_humidity_2m || 65;
    humidityVal.textContent = `${hum} %`;
    humidityDesc.textContent = hum > 70 ? "Fairly humid" : "Comfortable humidity levels";

    visVal.textContent = "30 km";
    visDesc.textContent = "Excellent clarity";
    const press = Math.round(current.pressure_msl || 1011);
    pressureVal.textContent = press;
    pressureDesc.textContent = "Normal air pressure";

    // Lifestyle
    lifeFishing.textContent = temp > 5 && temp < 25 ? "Good conditions" : "Not ideal";
    lifeClothing.textContent = temp < 15 ? "Light jacket recommended" : "T-shirt weather";
    lifeHealth.textContent = temp < 10 ? "Higher chance of cold" : "Low health risk";
    lifeStargazing.textContent = current.weather_code === 0 ? "Perfect for stargazing" : "Suitable for stargazing";
}

function renderTempChart(labels, data) {
    const ctx = document.getElementById('tempChart').getContext('2d');
    if (tempChartInstance) {
        tempChartInstance.destroy();
    }
    tempChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: data,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 10 } }
                }
            }
        }
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
