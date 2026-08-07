const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const cityNameEl = document.getElementById('city-name');
const dateTimeEl = document.getElementById('date-time');
const temperatureEl = document.getElementById('temperature');
const conditionEl = document.getElementById('condition');
const weatherIconEl = document.getElementById('weather-icon');
const windSpeedEl = document.getElementById('wind-speed');
const humidityEl = document.getElementById('humidity');
const uvIndexEl = document.getElementById('uv-index');
const aqiEl = document.getElementById('aqi');
const sunsetTimeEl = document.getElementById('sunset-time');
const hourlyContainer = document.getElementById('hourly-container');

// Load default location on startup
window.addEventListener('load', () => {
    fetchWeather("Helsinki");
});

searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    }
});

async function fetchWeather(city) {
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            alert("City not found!");
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        cityNameEl.textContent = `${name}, ${country || ''}`;

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,uv_index&daily=sunrise,sunset&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        updateUI(weatherData, aqiData);

    } catch (error) {
        console.error("Error fetching weather data:", error);
        alert("Failed to retrieve weather data.");
    }
}

function updateUI(data, aqiData) {
    const current = data.current;
    temperatureEl.textContent = `${Math.round(current.temperature_2m)}°C`;
    
    const now = new Date();
    dateTimeEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const weatherInfo = getWeatherDetails(current.weather_code, current.is_day);
    conditionEl.textContent = weatherInfo.text;
    weatherIconEl.innerHTML = `<i class="${weatherInfo.icon}"></i>`;

    windSpeedEl.textContent = `${current.wind_speed_10m} km/h`;
    humidityEl.textContent = `${current.relative_humidity_2m}%`;

    if (data.daily && data.daily.sunset && data.daily.sunset.length > 0) {
        const sunsetDate = new Date(data.daily.sunset[0]);
        sunsetTimeEl.textContent = sunsetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
        sunsetTimeEl.textContent = "N/A";
    }

    const currentHourIndex = new Date().getHours();
    if (data.hourly && data.hourly.uv_index) {
        uvIndexEl.textContent = data.hourly.uv_index[currentHourIndex] ?? 'N/A';
    } else {
        uvIndexEl.textContent = 'N/A';
    }

    if (aqiData && aqiData.current && aqiData.current.european_aqi !== undefined) {
        const aqiVal = aqiData.current.european_aqi;
        let aqiStatus = "Good";
        if (aqiVal > 40) aqiStatus = "Fair";
        if (aqiVal > 70) aqiStatus = "Moderate";
        if (aqiVal > 100) aqiStatus = "Poor";
        aqiEl.textContent = `${aqiVal} (${aqiStatus})`;
    } else {
        aqiEl.textContent = "N/A";
    }

    hourlyContainer.innerHTML = '';
    const hourly = data.hourly;
    if (hourly && hourly.time) {
        for (let i = currentHourIndex; i < currentHourIndex + 24; i++) {
            if (!hourly.time[i]) break;
            const temp = Math.round(hourly.temperature_2m[i]);
            const code = hourly.weather_code[i];
            
            const hourDate = new Date(hourly.time[i]);
            const formattedHour = hourDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            const hInfo = getWeatherDetails(code, 1);

            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            hourlyItem.innerHTML = `
                <span>${i === currentHourIndex ? 'Now' : formattedHour}</span>
                <i class="${hInfo.icon}"></i>
                <p>${temp}°C</p>
            `;
            hourlyContainer.appendChild(hourlyItem);
        }
    }
}

function getWeatherDetails(code, isDay) {
    switch (code) {
        case 0:
            return { text: isDay ? 'Sunny' : 'Clear', icon: isDay ? 'fa-solid fa-sun' : 'fa-solid fa-moon' };
        case 1:
        case 2:
            return { text: 'Partly Cloudy', icon: isDay ? 'fa-solid fa-cloud-sun' : 'fa-solid fa-cloud-moon' };
        case 3:
            return { text: 'Overcast', icon: 'fa-solid fa-cloud' };
        case 45:
        case 48:
            return { text: 'Foggy', icon: 'fa-solid fa-smog' };
        case 51:
        case 53:
        case 55:
            return { text: 'Drizzle', icon: 'fa-solid fa-cloud-rain' };
        case 61:
        case 63:
        case 65:
            return { text: 'Rain', icon: 'fa-solid fa-cloud-showers-heavy' };
        case 71:
        case 73:
        case 75:
            return { text: 'Snow', icon: 'fa-solid fa-snowflake' };
        case 95:
        case 96:
        case 99:
            return { text: 'Thunderstorm', icon: 'fa-solid fa-bolt' };
        default:
            return { text: 'Clear', icon: 'fa-solid fa-sun' };
    }
}

