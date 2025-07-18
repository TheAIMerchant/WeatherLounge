const bodyEl = document.body;
const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const geoButton = document.getElementById('geo-button');
const loader = document.getElementById('loader');
const cardContent = document.getElementById('card-content');
const locationEl = document.getElementById('location-name');
const iconEl = document.getElementById('weather-icon');
const tempEl = document.getElementById('temperature');
const descEl = document.getElementById('weather-description');
const feelsLikeEl = document.getElementById('feels-like');
const uvIndexEl = document.getElementById('uv-index');
const hourlyForecastEl = document.getElementById('hourly-forecast');

const rainSound = document.getElementById('rain-sound');
const windSound = document.getElementById('wind-sound');
const thunderSound = document.getElementById('thunder-sound');
const allSounds = [rainSound, windSound, thunderSound];

const icons = new Skycons({"color" : "white"});
icons.play();

window.addEventListener('DOMContentLoaded', () => {
    searchButton.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleSearch();
    });
    geoButton.addEventListener('click', handleGeolocation);
    bodyEl.addEventListener('mousemove', (e) => {
        bodyEl.style.setProperty('--mousex', `${(e.clientX / window.innerWidth) * 100}%`);
        bodyEl.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);
    });
});

function showLoader() {
    cardContent.classList.add('loading');
    loader.style.display = 'block';
}

function hideLoader() {
    cardContent.classList.remove('loading');
    loader.style.display = 'none';
}

function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        fetchCoordsByCity(city);
    }
    else {
        handleError('Please enter a city name.');
    }
}

function handleGeolocation() {
    if (navigator.geolocation) {
        showLoader();
        navigator.geolocation.getCurrentPosition(
            (position) => fetchWeatherByCoords(position.coords.latitude, position.coords.longitude), 
                () => handleError('Geolocation denied. Please search for a city.')
        );
    }
    else {
        handleError('Geolocation is not supported by your browser.');
    }
}

async function fetchCoordsByCity(city) {
    const geoUrl = `/api/weather?type=geo&city=${encodeURIComponent(city)}`;
    try {
        const response = await fetch(geoUrl);
        if (!response.ok) throw new Error('Network response was not ok.');
        const data = await response.json();
        if (data.length === 0) {
            handleError(`Could not find city: ${city}`);
            return;
        }
        const {lat, lon} = data[0];
        fetchWeatherByCoords(lat, lon);
    }
    catch (error) {
        handleError('Error fetching city coordinates.');
        console.error(error);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    const oneCallUrl = `/api/weather?type=weather&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(oneCallUrl);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        const data = await response.json();
        const cityName = await fetchCityName(lat, lon);
        updateUI(data.current, cityName);
    }
    catch (error) {
        handleError('Could not fetch weather data.');
        console.error(error);
    }   
}

async function fetchCityName(lat, lon) {
    const reverseGeoUrl = `/api/weather?type=reverseGeo&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(reverseGeoUrl);
        const data = await response.json();
        return data.length > 0 ? data[0].name : 'Current Location';
    }
    catch(error) {
        console.error('Could not fetch city name:', error);
        return 'Current Location';
    }
}

function updateUI(weatherData, cityName) {
    hideLoader();
    const {current, hourly} = weatherData;
    locationEl.textContent = cityName;
    tempEl.textContent = `${Math.round(current.temp)}°C`;
    descEl.textContent = current.weather[0].description;
    feelsLikeEl.textContent = `${Math.round(current.feels_like)}°C`;
    uvIndexEl.textContent = current.uvi;

    setThemeAndSound(current.weather[0].id);
    renderHourlyForecast(hourly);
}

function renderHourlyForecast(hourly) {
    hourlyForecastEl.innerHTML = '';
    const next12Hours = hourly.slice(1,13);
    next12Hours.forEach(hour => {
        const hourDiv = document.createElement('div');
        hourDiv.classList.add('hourly-item');
        const time = new Date(hour.dt * 1000).getHours();
        const iconID = `icon_${hour.dt}`;
        hourDiv.innerHTML = `
            <p>${time}:00</p>
            <canvas id="${iconID}" width="50" height="50"></canvas>
            <p class="temp">${Math.round(hour.temp)}°C</p>
        `;
        hourlyForecastEl.appendChild(hourDiv);
        icons.set(iconID, getWeatherIconName(hour.weather[0].id));
    });
}

function setThemeAndSound(weatherId) {
    const iconName = getWeatherIconName(weatherId);
    icons.set("weather-icon", iconName);
    bodyEl.className = getThemeClass(iconName);
    allSounds.forEach(sound => sound.pause());
    if (iconName.includes('RAIN')) {
        rainSound.play().catch(e => console.log("Audio autoplay blocked."));
    }
    else if (iconName.includes('WIND')) {
        windSound.play().catch(e => console.log("Audio autoplay blocked."));
    }
    else if (iconName.includes('SLEET') || iconName.includes('THUNDER')) {
        thunderSound.play().catch(e => console.log("Audio autoplay blocked."));
    }
}

function getWeatherIconName(weatherId) {
    if (weatherId >= 200 && weatherId < 300) return 'SLEET';
    if (weatherId >= 300 && weatherId < 600) return 'RAIN';
    if (weatherId >= 600 && weatherId < 700) return 'SNOW';
    if (weatherId >= 700 && weatherId < 800) return 'FOG';
    if (weatherId === 800) {
        const isDay = new Date().getHours() >= 6 && new Date().getHours() < 20;
        return isDay ? 'CLEAR_DAY' : 'CLEAR_NIGHT';
    }
    if (weatherId === 801 || weatherId === 802) return 'PARTLY_CLOUDY_DAY';
    if (weatherId > 802) return 'CLOUDY';
    return 'CLOUDY';
}

function getThemeClass(iconName) {
    if (iconName === 'CLEAR_DAY') return 'theme-sunny';
    if (iconName === 'CLEAR_NIGHT') return 'theme-night';
    if (iconName.includes('CLOUDY')) return 'theme-cloudy';
    if (iconName === 'RAIN') return 'theme-rainy';
    if (iconName === 'SNOW') return 'theme-snowy';
    if (iconName.includes('SLEET')) return 'theme-thunderstorm';
    if (iconName === 'FOG') return 'theme-misty';
    return 'theme-cloudy';
}

function handleError(message) {
    hideLoader();
    locationEl.textContent = 'Error!';
    descEl.textContent = message;
    icons.set("weather-icon", "CLOUDY");
    tempEl.textContent = '--°C';
    feelsLikeEl.textContent = '--°C';
    uvIndexEl.textContent = '--';
    hourlyForecastEl.innerHTML = '<p>Could not load forecast.</p>';
}