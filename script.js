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

// Weather Functions
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
        navigator.geolocation.getCurrentPosition(position => {
            fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
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
        fetchWeatherByCoords(latitude, longitude, `${name}, ${country}`);
        updateRecentSearches(name);
    } catch (err) {
        console.error(err);
    }
}

async function fetchWeatherByCoords(lat, lon, displayName = "Current Location") {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`);
        const data = await res.json();
        displayWeather(data, displayName);
    } catch (err) {
        console.error(err);
    }
}

function displayWeather(data, locationName) {
    weatherCard.classList.remove("hidden");
    document.getElementById("city-name").innerText = locationName;
    
    const temp = Math.round(data.current.temperature_2m);
    document.getElementById("temp").innerText = `${temp}°C`;
    document.getElementById("humidity").innerText = `Humidity: ${data.current.relative_humidity_2m}%`;
    document.getElementById("wind").innerText = `Wind: ${data.current.wind_speed_10m} m/s`;
    
    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);
    document.getElementById("high-low").innerText = `High: ${high}° | Low: ${low}°`;

    document.getElementById("aqi-val").innerText = "Good (32)";
    document.getElementById("uv-val").innerText = "Moderate (3.5)";

    let rec = "Enjoy your day outside!";
    if (temp < 10) {
        rec = "It's quite chilly! Make sure to wear a heavy jacket, scarf, and warm layers.";
    } else if (temp > 25) {
        rec = "Warm weather ahead! Keep hydrated, wear sunglasses, and apply sunscreen.";
    } else {
        rec = "Pleasant weather! Perfect time for a walk or outdoor activity.";
    }
    document.getElementById("rec-text").innerText = rec;

    const hourlyContainer = document.getElementById("hourly-container");
    hourlyContainer.innerHTML = "";
    for (let i = 0; i < 8; i++) {
        const hourDiv = document.createElement("div");
        hourDiv.className = "hourly-item";
        hourDiv.innerHTML = `<div>Now+${i}h</div><i class="fa-solid fa-cloud"></i><div>${Math.round(data.hourly.temperature_2m[i])}°</div>`;
        hourlyContainer.appendChild(hourDiv);
    }

    const forecastContainer = document.getElementById("forecast-container");
    forecastContainer.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
        const forecastDiv = document.createElement("div");
        forecastDiv.className = "forecast-item";
        forecastDiv.innerHTML = `<span>Day ${i}</span><i class="fa-solid fa-cloud-sun"></i><span>${Math.round(data.daily.temperature_2m_min[i])}° / ${Math.round(data.daily.temperature_2m_max[i])}°</span>`;
        forecastContainer.appendChild(forecastDiv);
    }
}
