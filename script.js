const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const geoButton = document.getElementById('geo-button');
const locationEl = document.getElementById('location-name');
const iconEl = document.getElementById('weather-icon');
const tempEl = document.getElementById('temperature');
const descEl = document.getElementById('weather-description');
const feelsLikeEl = document.getElementById('feels-like');
const uvIndexEl = document.getElementById('uv-index');
const bodyEl = document.body;

window.addEventListener('DOMContentLoaded', () => {
    searchButton.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleSearch();
    });
    geoButton.addEventListener('click', handleGeolocation);
});

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
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
                }, 
                () => {
                handleError('Geolocation denied. Please search for a city.');
            }
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
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
    locationEl.textContent = cityName;
    tempEl.textContent = `${Math.round(weatherData.temp)}°C`;
    descEl.textContent = weatherData.weather[0].description;
    feelsLikeEl.textContent = `${Math.round(weatherData.feels_like)}°C`;
    uvIndexEl.textContent = weatherData.uvi;

    setTheme(weatherData.weather[0].id);
}

function setTheme(weatherId) {
    let icon = '❓';
    let themeClass = 'theme-sunny';
    const isDay = new Date().getHours() >= 6 && new Date().getHours() < 20;

    if (weatherId >= 200 && weatherId < 300) {
        icon = '⚡️';
        themeClass = 'theme-thunderstorm';
    }
    else if (weatherId >= 300 && weatherId < 600) {
        icon = '🌧️';
        themeClass = 'theme-rainy';
    } 
    else if (weatherId >= 600 && weatherId < 700) {
        icon = '❄️';
        themeClass = 'theme-snowy';
    } 
    else if (weatherId >= 700 && weatherId < 800) {
        icon = '🌫️';
        themeClass = 'theme-misty';
    } 
    else if (weatherId === 800) {
        icon = isDay ? '☀️' : '🌙';
        themeClass = isDay ? 'theme-sunny' : 'theme-night';
    } 
    else if (weatherId > 800) {
        icon = '☁️';
        themeClass = 'theme-cloudy';
    }
    iconEl.textContent = icon;
    bodyEl.className = themeClass;
}

function handleError(message) {
    locationEl.textContent = 'Error!';
    descEl.textContent = message;
    iconEl.textContent = '😒';
    tempEl.textContent = '--°C';
    feelsLikeEl.textContent = '--°C';
    uvIndexEl.textContent = '--';
}