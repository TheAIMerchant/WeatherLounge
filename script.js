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
const foregroundOverlay = document.getElementById('foreground-overlay');
const weatherCard = document.querySelector('.weather-card');
const torchButton = document.getElementById('torch-button');
let isTorchActive = true;

const rainSound = document.getElementById('rain-sound');
const windSound = document.getElementById('wind-sound');
const thunderSound = document.getElementById('thunder-sound');
const allSounds = [rainSound, windSound, thunderSound];

const umbrellaButton = document.getElementById('umbrella-button');
let isUmbrellaActive = true;

const canvas = document.getElementById('effects-canvas');
const ctx = canvas.getContext('2d');
const skyCanvas = document.getElementById('sky-canvas');
const skyCtx = skyCanvas.getContext('2d');

const icons = new Skycons({"color" : "white"});
icons.play();
let shootingStars = [];
let particles = [];
let stars = [];
let userHasInteracted = false;
const mouse = {x: undefined, y: undefined, radius: 300};

window.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    searchButton.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleSearch();
    });
    geoButton.addEventListener('click', handleGeolocation);
    bodyEl.addEventListener('mousemove', (e) => {
        bodyEl.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`);
        bodyEl.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);
    });
    window.addEventListener('mousemove', e => {
        mouse.x = e.x;
        mouse.y = e.y;
    });
    window.addEventListener('resize', setupCanvas);
    document.getElementById('theme-tester').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            userHasInteracted = true;
            forceTheme(e.target.dataset.theme);
        }
    });
    weatherCard.addEventListener('mousemove', e => {
        if (bodyEl.classList.contains('theme-rainy')) {
            const rect = weatherCard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y =e.clientY - rect.top;

            weatherCard.style.setProperty('--mouse-x', `${x}px`);
            weatherCard.style.setProperty('--mouse-y', `${y}px`);
        }
    });
    umbrellaButton.addEventListener('click', toggleUmbrella);
    torchButton.addEventListener('click', toggleTorch);
    updateUmbrellaButton();
    animate();
});

function setupCanvas() {
    skyCanvas.width = window.innerWidth;
    skyCanvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (bodyEl.classList.contains('theme-rainy')) {
        createWeatherEffect('rainy');
    } else if (bodyEl.classList.contains('theme-snowy')) {
        createWeatherEffect('snowy');
    }
}

function markUserInteraction() {
    if (!userHasInteracted) {
        userHasInteracted = true;
    }
}

function showLoader() {
    cardContent.classList.add('loading');
    loader.style.display = 'block';
}

function hideLoader() {
    cardContent.classList.remove('loading');
    loader.style.display = 'none';
}

function handleSearch() {
    markUserInteraction();
    const city = cityInput.value.trim();
    if (city) {
        fetchCoordsByCity(city);
    } else {
        handleError('Please enter a city name.');
    }
}

function handleGeolocation() {
    markUserInteraction();
    if (navigator.geolocation) {
        showLoader();
        navigator.geolocation.getCurrentPosition(
            (position) => fetchWeatherByCoords(position.coords.latitude, position.coords.longitude), 
                () => handleError('Geolocation denied. Please search for a city.')
        );
    } else {
        handleError('Geolocation is not supported by your browser.');
    }
}

async function fetchCoordsByCity(city) {
    const Url = `/api/weather?type=geo&city=${city}`;
    try {
        const response = await fetch(Url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Could not find city.');
        }
        const data = await response.json();
        if (data.length === 0) {
            handleError(`Could not find city: ${city}`);
            return;
        }
        const {lat, lon} = data[0];
        await fetchWeatherByCoords(lat, lon);
    }
    catch (error) {
        handleError('Error fetching city coordinates.');
        console.error(error);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    const url = `/api/weather?type=weather&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Could not fetch weather.');
        }
        const data = await response.json();
        const cityName = await fetchCityName(lat, lon);
        updateUI(data, cityName);
    }
    catch (error) {
        handleError(error.message);
        console.error(error);
    }   
}

async function fetchCityName(lat, lon) {
    const url = `/api/weather?type=reverseGeo&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not fetch city name.')
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
    
    if (hourly && Array.isArray(hourly)) {
        renderHourlyForecast(hourly);
    } else {
        console.warn("Hourly forecast data not available for this location.");
        hourlyForecastEl.innerHTML = '<p style="text-align: center; opacity: 0.7;">Hourly data not available.</p>';
    }
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

function toggleUmbrella() {
    isUmbrellaActive = !isUmbrellaActive;
    updateUmbrellaButton();
}

function updateUmbrellaButton() {
    if (isUmbrellaActive) {
        umbrellaButton.classList.add('active');
        umbrellaButton.title = "Interaction is ON";
    } else {
        umbrellaButton.classList.remove('active');
        umbrellaButton.title = "Interaction is OFF";
    }
}

function toggleTorch() {
    isTorchActive = !isTorchActive;
    updateTorchButton();
}

function updateTorchButton() {
    if (isTorchActive) {
        torchButton.classList.add('active');
        bodyEl.classList.add('torch-on');
    } else {
        torchButton.classList.remove('active');
        bodyEl.classList.remove('torch-on');
    }
}

class Particle {
    constructor(x, y, size, speedX, speedY) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speedX = speedX;
        this.speedY = speedY;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (isUmbrellaActive) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouse.radius) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (mouse.radius - distance) / mouse.radius;
                const forceMultiplier = 10;
                const directionX = forceDirectionX * force * this.size * forceMultiplier;
                const directionY = forceDirectionY * force * this.size * forceMultiplier;
                this.x -= directionX;
                this.y -= directionY;
            }
        }
        if (this.y > canvas.height + this.size || this.x > canvas.width + this.size || this.x < -this.size) {
            this.y = -this.size;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class RainDrop extends Particle {
    draw() {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.speedX * 3, this.y + this.speedY * 3);
        ctx.stroke();
    }
}

class Snowflake extends Particle {
    constructor(x, y, size, speedX, speedY) {
        super(x, y, size, speedX, speedY);
        this.angle = Math.random() * Math.PI * 2;
        this.spin = Math.random() < 0.5 ? 0.005 : -0.005;
    }

    update() {
        this.angle += this.spin;
        this.x += Math.sin(this.angle) * 0.5;
        super.update();
    }

    draw() {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 1.5;
        this.alpha = Math.random() * 0.5 + 0.5;
        this.twinkleSpeed = Math.random() * 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.alpha += this.twinkleSpeed;
        if (this.alpha > 1 || this.alpha < 0.3) {
            this.twinkleSpeed *= -1;
        }
    }
}

class shootingStar {
    constructor() {
        this.reset();        
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = 0;
        this.len = Math.random() * 80 + 10;
        this.speed = Math.random() * 10 + 6;
        this.active = true;
    }
    update() {
        if (this.active) {
            this.x -= this.speed;
            this.y += this.speed;
            if (this.x < 0 || this.y > canvas.height) {
                this.active = false;
            }
        }
    }
    draw() {
        if (this.active) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.len, this.y - this.len);
            ctx.stroke();
        }
    }
}

function createStars() {
    stars = [];
    const starCount = window.innerWidth / 8;
    for (let i = 0; i < starCount; i++) {
        stars.push(new Star());
    }
}

function createWeatherEffect(effectType) {
    particles = [];
    let particleCount = effectType === 'rainy' ? 800 : 200;

    for (let i = 0; i < particleCount; i++) {
        let size = Math.random() * (effectType === 'rainy' ? 1.5 : 3) + 1;
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        let speedX = effectType === 'rainy' ? 2.5 : Math.random() * 0.5 - 0.25;
        let speedY = effectType === 'rainy' ? Math.random() * 8 + 6 : Math.random() * 1.5 + 0.5;

        if (effectType === 'rainy') {
            particles.push(new RainDrop(x, y, size, speedX, speedY));
        } else if (effectType === 'snowy') {
            particles.push(new Snowflake(x, y, size, speedX, speedY));
        }
    }
}

function drawLightning() {
    if (Math.random() > 0.99) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    skyCtx.clearRect(0, 0, skyCanvas.width, skyCanvas.height);

    if (stars.length > 0) {
        stars.forEach(star => {
            star.update();
            star.draw();
        });
    }

    if (particles.length > 0) {
        particles.forEach(p => {
            p.update();
            p.draw();
        });
    }

    if (bodyEl.classList.contains('theme-sunny')) {
        let sunX = canvas.width / 2;
        let sunY = 0;
        let gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, canvas.width / 2);
        gradient.addColorStop(0, 'rgba(255, 255, 220, 0.2)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 220, 0.0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bodyEl.classList.contains('theme-thunderstorm')) {
        if (Math.random() > 0.995) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else if (bodyEl.classList.contains('theme-night')) {
        if (Math.random() < 0.01 && shootingStars.length < 3) {
            shootingStars.push(new shootingStar());
        }
        shootingStars.forEach((star, index) => {
            star.update();
            star.draw();
            if (!star.active) {
                shootingStars.splice(index, 1);
            }
        });
    }
    requestAnimationFrame(animate);
}

function forceTheme(theme) {
    bodyEl.className = `theme-${theme}`;
    foregroundOverlay.className = `overlay-${theme}`;
    stopAllSounds();
    particles = [];
    stars = [];
    bodyEl.classList.remove('show-snow-buildup');

    if (theme === 'rainy') {
        rainSound.play().catch(e => {});
        createWeatherEffect('rainy');
    } else if (theme === 'snowy') {
        createWeatherEffect('snowy');
        setTimeout(() => {
            bodyEl.classList.add('show-snow-buildup');
        }, 2000);
    } else if (theme === 'thunderstorm') {
        thunderSound.play().catch(e => {});
    } else if (theme === 'windy') {
        windSound.play().catch(e => {});
    }
    if (theme === 'night') {
        createStars();
        isTorchActive = true;
    } else {
        isTorchActive = false;
    }
    updateTorchButton();
}

function setThemeAndSound(weatherId) {
    const iconName = getWeatherIconName(weatherId);
    icons.set("weather-icon", iconName);
    const theme = getThemeClass(iconName).replace('theme-', '');
    forceTheme(theme);
}

function stopAllSounds(){
    allSounds.forEach(sound => {
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    });    
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