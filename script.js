const apiKey = "551faa0115334e9b5288146b307ff46b";
const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");
const locationBtn = document.getElementById("locationBtn");
const recentSearchesContainer = document.getElementById("recentSearchesContainer");
const recentTags = document.getElementById("recentTags");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// Initialize recent searches on page load
document.addEventListener("DOMContentLoaded", () => {
    renderRecentSearches();
});

searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (city === "") {
        alert("Please enter a city name.");
        return;
    }
    fetchWeatherData(city);
});

cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const city = cityInput.value.trim();
        if (city !== "") {
            fetchWeatherData(city);
        }
    }
});

if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
        localStorage.removeItem("weatherRecentSearches");
        renderRecentSearches();
    });
}

if (locationBtn) {
    locationBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    fetchWeatherDataByCoords(position.coords.latitude, position.coords.longitude);
                },
                () => {
                    handleSavedLocation();
                }
            );
        } else {
            handleSavedLocation();
        }
    });
}

function handleSavedLocation() {
    let savedCity = localStorage.getItem('weatherHomeCity');
    if (!savedCity) {
        savedCity = prompt("Enter your exact town name (e.g., Rantasalmi):");
        if (savedCity && savedCity.trim() !== "") {
            savedCity = savedCity.trim();
            localStorage.setItem('weatherHomeCity', savedCity);
        } else {
            return;
        }
    }
    cityInput.value = savedCity;
    fetchWeatherData(savedCity);
}

// Save city to localStorage search history
function saveRecentSearch(cityName) {
    let searches = JSON.parse(localStorage.getItem("weatherRecentSearches")) || [];
    
    // Remove duplicate entry if it exists (case-insensitive)
    searches = searches.filter(city => city.toLowerCase() !== cityName.toLowerCase());
    
    // Add new search to beginning
    searches.unshift(cityName);
    
    // Keep top 5 searches
    if (searches.length > 5) {
        searches = searches.slice(0, 5);
    }
    
    localStorage.setItem("weatherRecentSearches", JSON.stringify(searches));
    renderRecentSearches();
}

// Render search history tags
function renderRecentSearches() {
    const searches = JSON.parse(localStorage.getItem("weatherRecentSearches")) || [];
    recentTags.innerHTML = "";
    
    if (searches.length === 0) {
        recentSearchesContainer.style.display = "none";
        return;
    }

    recentSearchesContainer.style.display = "block";
    searches.forEach(city => {
        const tag = document.createElement("button");
        tag.className = "recent-tag";
        tag.innerText = city;
        tag.addEventListener("click", () => {
            cityInput.value = city;
            fetchWeatherData(city);
        });
        recentTags.appendChild(tag);
    });
}

async function fetchWeatherData(city) {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "City not found");
        
        updateUI(data);
        saveRecentSearch(data.name); // Save verified city name to history

        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${apiKey}`);
        const forecastData = await forecastRes.json();
        if (forecastRes.ok) {
            updateHourlyUI(forecastData);
            updateDailyUI(forecastData);
        }
    } catch (error) {
        alert(error.message);
    }
}

async function fetchWeatherDataByCoords(lat, lon) {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Weather data not found");
        
        updateUI(data);
        saveRecentSearch(data.name);

        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
        const forecastData = await forecastRes.json();
        if (forecastRes.ok) {
            updateHourlyUI(forecastData);
            updateDailyUI(forecastData);
        }
    } catch (error) {
        alert(error.message);
    }
}

function updateUI(data) {
    document.getElementById("city").innerText = data.name;
    document.getElementById("weather").innerText = data.weather[0].description;
    document.getElementById("temp").innerText = `${Math.round(data.main.temp)}°C`;
    document.getElementById("humidity").innerText = `${data.main.humidity}%`;
    document.getElementById("wind").innerText = `${data.wind.speed} m/s`;

    const high = Math.round(data.main.temp_max);
    const low = Math.round(data.main.temp_min);
    document.getElementById("highLow").innerText = `High: ${high}° | Low: ${low}°`;

    const timezoneOffset = data.timezone;
    document.getElementById("sunrise").innerText = formatUnixTime(data.sys.sunrise, timezoneOffset);
    document.getElementById("sunset").innerText = formatUnixTime(data.sys.sunset, timezoneOffset);

    const iconCode = data.weather[0].icon;
    const iconImg = document.getElementById("weather-icon");
    iconImg.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    iconImg.style.display = "block";

    setDynamicBackground(data.weather[0].main);
}

function updateHourlyUI(forecastData) {
    const container = document.getElementById("hourlyContainer");
    container.innerHTML = "";
    
    forecastData.list.slice(0, 7).forEach((item, index) => {
        let timeString;
        if (index === 0) {
            timeString = "Now";
        } else {
            const dateObj = new Date(item.dt * 1000);
            timeString = dateObj.toLocaleTimeString([], { hour: 'numeric', hour12: true }).toLowerCase();
        }

        const temp = Math.round(item.main.temp);
        const icon = item.weather[0].icon;
        
        const popPercentage = item.pop ? Math.round(item.pop * 100) : 0;
        const popText = popPercentage >= 30 ? `${popPercentage}%` : "";

        const div = document.createElement("div");
        div.className = "hourly-item";
        div.innerHTML = `
            <p>${timeString}</p>
            <img src="https://openweathermap.org/img/wn/${icon}.png" alt="icon">
            <span class="hourly-pop">${popText}</span>
            <span>${temp}°</span>
        `;
        container.appendChild(div);
    });
}

function updateDailyUI(forecastData) {
    const container = document.getElementById("dailyForecastContainer");
    container.innerHTML = "";

    const dailyMap = {};
    forecastData.list.forEach(item => {
        const date = item.dt_txt.split(" ")[0];
        if (!dailyMap[date]) {
            dailyMap[date] = {
                temps: [],
                icon: item.weather[0].icon,
                dt: item.dt
            };
        }
        dailyMap[date].temps.push(item.main.temp);
        if (item.dt_txt.includes("12:00:00")) {
            dailyMap[date].icon = item.weather[0].icon;
        }
    });

    const daysArray = Object.keys(dailyMap).slice(0, 5);
    daysArray.forEach((date, index) => {
        const dayData = dailyMap[date];
        const high = Math.round(Math.max(...dayData.temps));
        const low = Math.round(Math.min(...dayData.temps));
        
        let dayName = new Date(dayData.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
        if (index === 0) dayName = "Today";

        const div = document.createElement("div");
        div.className = "forecast-item";
        div.innerHTML = `
            <span class="forecast-day">${dayName}</span>
            <img class="forecast-icon" src="https://openweathermap.org/img/wn/${dayData.icon}.png" alt="icon">
            <div class="forecast-temps">
                <span class="forecast-low">${low}°</span>
                <span class="forecast-high">${high}°</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function formatUnixTime(unixTimestamp, timezoneOffset) {
    const d = new Date((unixTimestamp + timezoneOffset) * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

function setDynamicBackground(weatherMain) {
    let bgUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb';
    switch (weatherMain.toLowerCase()) {
        case 'clear': bgUrl = 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55'; break;
        case 'clouds': bgUrl = 'https://images.unsplash.com/photo-1534088568595-a066f410bcda'; break;
        case 'rain':
        case 'drizzle': bgUrl = 'https://images.unsplash.com/photo-1519692933481-e162a57d6721'; break;
        case 'thunderstorm': bgUrl = 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28'; break;
        case 'snow': bgUrl = 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22'; break;
    }
    document.body.style.background = `url('${bgUrl}') no-repeat center center fixed`;
    document.body.style.backgroundSize = 'cover';
}
