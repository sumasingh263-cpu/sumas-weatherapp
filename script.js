const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const geoBtn = document.getElementById("geo-btn");
const recentList = document.getElementById("recent-list");

let recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || ["Helsinki", "Rantasalmi"];

// Background Canvas Particles
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
        this.speedY = Math.random() * 0.4 - 0.2;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.opacity = Math.random() * 0.4 + 0.1;
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
    for (let i = 0; i < 40; i++) particles.push(new Particle());
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
}
initParticles();
animateParticles();

// Default load
fetchWeather("Rantasalmi");

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
                const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const revData = await revRes.json();
                const cityName = revData.address.city || revData.address.town || revData.address.village || "Current Location";
                fetchWeatherByCoords(lat, lon, cityName);
            } catch {
                fetchWeatherByCoords(lat, lon, "Current Location");
            }
        });
    }
});

function updateRecentSearches(city) {
    if (!recentSearches.includes(city)) {
        recentSearches.unshift(city);
        if (recentSearches.length > 4) recentSearches.pop();
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
        const { latitude, longitude, name } = geoData.results[0];
        fetchWeatherByCoords(latitude, longitude, name);
        updateRecentSearches(name);
    } catch (err) {
        console.error(err);
    }
}

async function fetchWeatherByCoords(lat, lon, locationName) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,uv_index&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`);
        const data = await res.json();
        displayWeather(data, locationName);
    } catch (err) {
        console.error(err);
    }
}

function displayWeather(data, locationName) {
    document.getElementById("city-name").innerText = locationName;
    
    const temp = Math.round(data.current.temperature_2m);
    document.getElementById("temp").innerText = `${temp}°`;
    
    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);
    document.getElementById("high-low").innerText = `High: ${high}° Low: ${low}°`;
    document.getElementById("weather-desc").innerText = "Sunny & Clear";

    // Metrics updates
    const apparent = Math.round(data.current.apparent_temperature);
    document.getElementById("feels-val").innerText = `${apparent}°`;
    document.getElementById("feels-desc").innerText = `Actual temperature: ${temp}°`;

    const windSpeed = data.current.wind_speed_10m;
    document.getElementById("wind-speed").innerText = windSpeed;

    const humidity = data.current.relative_humidity_2m;
    document.getElementById("humidity-val").innerText = `${humidity} %`;
    document.getElementById("humidity-desc").innerText = humidity > 70 ? "Fairly humid, dew is likely to form" : "Comfortable moisture levels";

    const uvMax = data.daily.uv_index_max ? data.daily.uv_index_max[0] : 2.5;
    document.getElementById("uv-num").innerText = uvMax;
    document.getElementById("uv-title").innerText = uvMax < 3 ? "Low" : (uvMax < 6 ? "Moderate" : "High");
    document.getElementById("uv-desc").innerText = uvMax < 3 ? "Almost no risk of sunburn" : "Sun protection recommended";

    // Sun times formatting
    const sunriseStr = data.daily.sunrise[0].split("T")[1];
    const sunsetStr = data.daily.sunset[0].split("T")[1];
    document.getElementById("sunrise-time").innerText = `Sunrise: ${sunriseStr}`;
    document.getElementById("sunset-time").innerText = sunsetStr;

    // Hourly generator
    const hourlyContainer = document.getElementById("hourly-container");
    hourlyContainer.innerHTML = "";
    for (let i = 0; i < 8; i++) {
        const timeLabel = i === 0 ? "Now" : `+${i}h`;
        const hourDiv = document.createElement("div");
        hourDiv.className = "hourly-item";
        hourDiv.innerHTML = `<span>${timeLabel}</span><i class="fa-solid fa-sun"></i><span>${Math.round(data.hourly.temperature_2m[i])}°</span>`;
        hourlyContainer.appendChild(hourDiv);
    }

    // 5-Day forecast generator
    const forecastContainer = document.getElementById("forecast-container");
    forecastContainer.innerHTML = "";
    const days = ["Today", "Fri", "Sat", "Sun", "Mon"];
    for (let i = 0; i < 5; i++) {
        const minT = Math.round(data.daily.temperature_2m_min[i]);
        const maxT = Math.round(data.daily.temperature_2m_max[i]);
        const forecastDiv = document.createElement("div");
        forecastDiv.className = "forecast-item";
        forecastDiv.innerHTML = `
            <span style="width: 50px;">${days[i]}</span>
            <i class="fa-solid fa-cloud-sun" style="color: #fbbf24;"></i>
            <span style="margin-left: 10px; width: 30px; text-align: right;">${minT}°</span>
            <div class="forecast-bar"><div class="forecast-progress" style="left: 20%; width: 60%;"></div></div>
            <span style="width: 30px;">${maxT}°</span>
        `;
        forecastContainer.appendChild(forecastDiv);
    }
}
