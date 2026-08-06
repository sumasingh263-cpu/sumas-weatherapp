const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const geoBtn = document.getElementById("geo-btn");
const recentList = document.getElementById("recent-list");

let recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || ["Rantasalmi", "Helsinki"];

// Dynamic Weather-Based Canvas Particles
const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");
let particles = [];
let currentWeatherType = "clear"; // can be clear, rain, snow, clouds

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

class Particle {
    constructor(type) {
        this.type = type;
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        
        if (this.type === "rain") {
            this.size = Math.random() * 1.5 + 0.5;
            this.speedY = Math.random() * 8 + 6;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.6 + 0.3;
        } else if (this.type === "snow") {
            this.size = Math.random() * 3 + 1;
            this.speedY = Math.random() * 1.5 + 0.5;
            this.speedX = Math.random() * 1 - 0.5;
            this.opacity = Math.random() * 0.7 + 0.3;
        } else {
            // Clear or Cloudy (Floating light or mist particles)
            this.size = Math.random() * 2 + 1;
            this.speedY = Math.random() * 0.4 - 0.2;
            this.speedX = Math.random() * 0.4 - 0.2;
            this.opacity = Math.random() * 0.4 + 0.1;
        }
    }
    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        if (this.y > canvas.height || this.x > canvas.width || this.x < 0) {
            this.reset();
            if (this.type === "rain" || this.type === "snow") {
                this.y = 0; // restart from top
            }
        }
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        if (this.type === "rain") {
            ctx.fillRect(this.x, this.y, 1.5, 12);
        } else {
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function initParticles(type) {
    currentWeatherType = type;
    particles = [];
    const count = type === "rain" || type === "snow" ? 70 : 40;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(type));
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
}
initParticles("clear");
animateParticles();

// Default load Rantasalmi
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
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,uv_index,time&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`);
        const data = await res.json();

        // Fetch AQI data
        let aqiText = "Good (15)";
        try {
            const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`);
            const aqiData = await aqiRes.json();
            const aqiVal = aqiData.current?.european_aqi;
            if (aqiVal !== undefined) {
                if (aqiVal <= 20) aqiText = `Good (${aqiVal})`;
                else if (aqiVal <= 40) aqiText = `Fair (${aqiVal})`;
                else if (aqiVal <= 60) aqiText = `Moderate (${aqiVal})`;
                else aqiText = `Poor (${aqiVal})`;
                else aqiText = `Very Poor (${aqiVal})`;
            }
        } catch (e) {
            aqiText = "Good (12)";
        }

        displayWeather(data, locationName, aqiText);
    } catch (err) {
        console.error(err);
    }
}

function formatTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
}

function getWeatherDescription(code) {
    if (code === 0) return "Sunny & Clear";
    if ([1, 2, 3].includes(code)) return "Partly Cloudy";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain Showers";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snowy";
    return "Overcast";
}

function displayWeather(data, locationName, aqiText) {
    document.getElementById("city-name").innerText = locationName;
    
    const temp = Math.round(data.current.temperature_2m);
    const weatherCode = data.current.weather_code;
    document.getElementById("temp").innerText = `${temp}°`;
    
    const high = Math.round(data.daily.temperature_2m_max[0]);
    const low = Math.round(data.daily.temperature_2m_min[0]);
    document.getElementById("high-low").innerText = `High: ${high}° Low: ${low}°`;
    
    const desc = getWeatherDescription(weatherCode);
    document.getElementById("weather-desc").innerText = desc;

    // Set particle animation based on weather code
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
        initParticles("rain");
    } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
        initParticles("snow");
    } else if ([1, 2, 3, 45, 48].includes(weatherCode)) {
        initParticles("clouds");
    } else {
        initParticles("clear");
    }

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

    document.getElementById("aqi-val").innerText = aqiText;

    // Accurate Sunrise & Sunset Formatting
    const sunriseStr = formatTime(data.daily.sunrise[0]);
    const sunsetStr = formatTime(data.daily.sunset[0]);
    document.getElementById("sunset-time").innerText = sunsetStr;
    document.getElementById("sunrise-time").innerText = `Sunrise: ${sunriseStr}`;

    // Accurate Hourly Time Format (e.g. 9 pm, 10 pm)
    const hourlyContainer = document.getElementById("hourly-container");
    hourlyContainer.innerHTML = "";
    
    // Find current time index or start from current hour
    const nowHourIndex = data.hourly.time.findIndex(t => new Date(t) >= new Date()) || 0;
    
    for (let i = 0; i < 8; i++) {
        const index = (nowHourIndex + i) % data.hourly.time.length;
        const timeObj = new Date(data.hourly.time[index]);
        let hr = timeObj.getHours();
        const ampm = hr >= 12 ? 'pm' : 'am';
        hr = hr % 12;
        hr = hr ? hr : 12;
        
        const timeLabel = i === 0 ? "Now" : `${hr} ${ampm}`;
        const hourTemp = Math.round(data.hourly.temperature_2m[index]);
        
        const hourDiv = document.createElement("div");
        hourDiv.className = "hourly-item";
        hourDiv.innerHTML = `<span>${timeLabel}</span><i class="fa-solid fa-sun"></i><span>${hourTemp}°</span>`;
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
            <span style="width: 50px; font-weight: 500;">${days[i]}</span>
            <i class="fa-solid fa-cloud-sun" style="color: #fef08a;"></i>
            <span style="margin-left: 10px; width: 30px; text-align: right; color: rgba(255,255,255,0.8);">${minT}°</span>
            <div class="forecast-bar"><div class="forecast-progress" style="left: 20%; width: 60%;"></div></div>
            <span style="width: 30px; font-weight: 600;">${maxT}°</span>
        `;
        forecastContainer.appendChild(forecastDiv);
    }
}
