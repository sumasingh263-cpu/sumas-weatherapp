const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const geoBtn = document.getElementById("geo-btn");
const weatherCard = document.getElementById("weather-card");
const recentList = document.getElementById("recent-list");

let recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || [];

// Canvas Particle Effect
const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
    }
    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

// Weather Event Listeners
searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (city) fetchWeather(city);
});

cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const city = cityInput.value.trim();
        if (city) fetchWeather(city);
    }
});

geoBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                // Reverse geocode to get the actual city/town name
                const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const revData = await revRes.json();
                const cityName = revData.address.city || revData.address.town || revData.address.village || revData.address.county || "Current Location";
                fetchWeatherByCoords(lat, lon, cityName);
                updateRecentSearches(cityName);
            } catch {
                fetchWeatherByCoords(lat, lon, "Current Location");
            }
        });
    }
});

function updateRecentSearches(city) {
    if (!recentSearches.includes(city)) {
        recentSearches.unshift(city);
        if (recentSearches.length > 5) recentSearches.pop();
        localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
    }
    renderRecentSearches();
}

function renderRecentSearches() {
    recentList.innerHTML = "";
    recentSearches.forEach(city => {
        const tag = document.createElement("div");
        tag.className = "recent-tag";
        tag.innerText = city;
        tag.addEventListener("click", () => fetchWeather(city));
        recentList.appendChild(tag);
    });
}
renderRecentSearches();

async function fetchWeather(city) {
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        const geoData = await geoRes.json();
        if (!geoData.results) {
            alert("City not found");
            return;
        }
        const { latitude, longitude, name, country } = geoData.results[0];
        const displayName = `${name}, ${country || ''}`;
        fetchWeatherByCoords(latitude, longitude, displayName);
        updateRecentSearches(name);
    } catch (err) {
        console.error(err);
    }
}

async function fetchWeatherByCoords(lat, lon, locationName) {
    try {
        // Fetch Weather and UV Index data
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`);
        const data = await res.json();

        // Fetch Air Quality data
        let aqiText = "Good (15)";
        try {
            const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`);
            const aqiData = await aqiRes.json();
            const aqiVal = aqiData.current?.european_aqi;
            if (aqiVal !== undefined) {
                if (aqiVal <= 20) aqiText = `Good (${aqiVal})`;
                else if (aqiVal <= 40) aqiText = `Fair (${aqiVal})`;
                else if (aqiVal <= 60) aqiText = `Moderate (${aqiVal})`;
                else if (aqiVal <= 80) aqiText = `Poor (${aqiVal})`;
                else aqiText = `Very Poor (${aqiVal})`;
            }
        } catch (e) {
            console.log("AQI fetch failed, using default");
        }

        displayWeather(data, locationName, aqiText);
    } catch (err) {
        console.error(err);
    }
}

function displayWeather(data, locationName, aqiText) {
    weatherCard.classList.remove("hidden");
    document.getElementById("city-name").innerText = locationName;
    
    const temp = Math.round(data.current.temperature_2m);
    const weatherCode = data.current.weather_code;
    const windSpeed = data.current.wind_speed_10m;
    
    document.getElementById("temp").innerText = `${temp}°C`;
    document.getElementById("humidity").innerText = `Humidity: ${data.current.relative_humidity_2m}%`;
    document.getElementById("wind").innerText = `Wind: ${windSpeed} m/s`;
    
    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);
    document.getElementById("high-low").innerText = `High: ${high}° | Low: ${low}°`;

    // Dynamic UV Index
    const uvMax = data.daily.uv_index_max ? data.daily.uv_index_max[0] : 3.0;
    let uvCategory = "Low";
    if (uvMax >= 3 && uvMax < 6) uvCategory = "Moderate";
    else if (uvMax >= 6 && uvMax < 8) uvCategory = "High";
    else if (uvMax >= 8) uvCategory = "Very High";
    document.getElementById("uv-val").innerText = `${uvCategory} (${uvMax})`;

    // Dynamic AQI
    document.getElementById("aqi-val").innerText = aqiText;

    // Dynamic Smart Recommendations based on weather code, temp, wind, and UV
    let rec = "Enjoy your day outside!";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
        rec = "Rain is expected! Don't forget to take an umbrella and wear waterproof shoes.";
    } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
        rec = "Snowy conditions outside! Bundle up in warm winter gear and watch out for slippery paths.";
    } else if (windSpeed > 10) {
        rec = "It's quite windy today! A windbreaker jacket is recommended if you're stepping out.";
    } else if (temp < 0) {
        rec = "Freezing temperatures! Wear heavy thermal layers, gloves, and a winter hat.";
    } else if (temp < 10) {
        rec = "Chilly weather! Make sure to wear a jacket, sweater, and warm layers.";
    } else if (temp > 25 && uvMax >= 5) {
        rec = "Hot and sunny! Stay hydrated, wear sunglasses, and apply sunscreen before heading out.";
    } else if (temp > 25) {
        rec = "Warm weather ahead! Light clothing and a cold drink will keep you comfortable.";
    } else {
        rec = "Pleasant weather conditions! Great time for a walk, run, or outdoor activities.";
    }
    document.getElementById("rec-text").innerText = rec;

    // Hourly forecast generator
    const hourlyContainer = document.getElementById("hourly-container");
    hourlyContainer.innerHTML = "";
    for (let i = 0; i < 8; i++) {
        const hourDiv = document.createElement("div");
        hourDiv.className = "hourly-item";
        hourDiv.innerHTML = `<div>+${i}h</div><i class="fa-solid fa-cloud"></i><div>${Math.round(data.hourly.temperature_2m[i])}°</div>`;
        hourlyContainer.appendChild(hourDiv);
    }

    // 5-Day forecast generator
    const forecastContainer = document.getElementById("forecast-container");
    forecastContainer.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
        const forecastDiv = document.createElement("div");
        forecastDiv.className = "forecast-item";
        forecastDiv.innerHTML = `<span>Day ${i}</span><i class="fa-solid fa-cloud-sun"></i><span>${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</span>`;
        forecastContainer.appendChild(forecastDiv);
    }
}
