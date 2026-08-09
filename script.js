// Default coordinates for Kathmandu / Fallback
let currentLat = 27.7172;
let currentLon = 85.3240;
let currentCityName = "Kathmandu";

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    fetchWeatherData(currentLat, currentLon, currentCityName);
}

function setupEventListeners() {
    const locationToggleBtn = document.getElementById("location-toggle-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const closeSearchBtn = document.getElementById("close-search-btn");
    const searchContainer = document.getElementById("search-container");
    const searchInput = document.getElementById("search-input");
    const currentLocBtn = document.getElementById("current-loc-btn");

    locationToggleBtn.addEventListener("click", () => {
        searchContainer.classList.remove("hidden");
        searchInput.focus();
    });

    cancelBtn.addEventListener("click", () => {
        searchContainer.classList.add("hidden");
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
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch weather data");
        const data = await response.json();

        updateCurrentWeather(data, cityName);
        updateHourlyWeather(data);
        updateDailyForecast(data);
        updateDetails(data);
        updateLifestyle(data);

    } catch (err) {
        console.error(err);
        showErrorBanner("Failed to load weather data. Please try again.");
    }
}

function updateCurrentWeather(data, cityName) {
    document.getElementById("city-title").textContent = cityName;
    const current = data.current;
    const daily = data.daily;

    document.getElementById("temp-display").textContent = `${Math.round(current.temperature_2m)}°`;
    
    if (daily && daily.temperature_2m_max && daily.temperature_2m_min) {
        const high = Math.round(daily.temperature_2m_max[0]);
        const low = Math.round(daily.temperature_2m_min[0]);
        document.getElementById("high-low-display").textContent = `High: ${high}° Low: ${low}°`;
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
        const temp = Math.round(temps[i]);
        const icon = getWeatherIcon(codes[i]);
        const rainProb = precip[i] > 0 ? `${precip[i]}%` : "";

        const item = document.createElement("div");
        item.className = "hourly-item";
        item.innerHTML = `
            <span class="hourly-time">${timeLabel}</span>
            <span class="hourly-icon">${icon}</span>
            <span class="hourly-temp">${temp}°</span>
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
        
        const max = Math.round(maxs[index]);
        const min = Math.round(mins[index]);
        const icon = getWeatherIcon(codes[index]);

        const leftPercent = ((min - overallMin) / span) * 100;
        const widthPercent = ((max - min) / span) * 100;

        const row = document.createElement("div");
        row.className = "forecast-row";
        row.innerHTML = `
            <span class="forecast-day">${dayName}</span>
            <span class="forecast-icon-wrap">${icon}</span>
            <div class="forecast-bar-track">
                <div class="forecast-bar-fill" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
            </div>
            <div class="forecast-temps">
                <span>${max}°</span>
                <span>${min}°</span>
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

    const feels = Math.round(current.apparent_temperature);
    const actual = Math.round(current.temperature_2m);
    document.getElementById("feels-val").textContent = `${feels}°`;
    document.getElementById("feels-actual").textContent = `Actual temperature: ${actual}°`;

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

    document.getElementById("visibility-val").textContent = "10 km";
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
