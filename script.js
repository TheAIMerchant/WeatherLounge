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

// Canvases
const skyCanvas = document.getElementById('sky-canvas');
const skyCtx = skyCanvas.getContext('2d');
const effectsCanvas = document.getElementById('effects-canvas');
const effectsCtx = effectsCanvas.getContext('2d');
const weatherCard = document.querySelector('.weather-card');
const cardEffectsCanvas = document.getElementById('card-effects-canvas');
const cardEffectsCtx = cardEffectsCanvas.getContext('2d');

// Tools
const umbrellaButton = document.getElementById('umbrella-button');
const heaterButton = document.getElementById('heater-button');
const torchButton = document.getElementById('torch-button');

// Audio
const rainSound = document.getElementById('rain-sound');
const windSound = document.getElementById('wind-sound');
const thunderSound = document.getElementById('thunder-sound');
const allSounds = [rainSound, windSound, thunderSound];


const icons = new Skycons({"color" : "white"});
icons.play();
let currentTheme = 'night'
let particles = [];
let stars = [];
let clouds = [];
let frostLines = [];
let waterDroplets = [];
let userHasInteracted = false;
let shootingStars = [];
let isUmbrellaActive = true;
let isHeaterActive = true;
let isTorchActive = true;
const mouse = {x: undefined, y: undefined, radius: 300};

window.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    addEventListeners();
    forceTheme('night');
    animate();
});

function addEventListeners() {
    searchButton.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleSearch();
    });
    geoButton.addEventListener('click', handleGeolocation);
    window.addEventListener('mouusemove', handleMouseMove);
    window.addEventListener('resize', setupCanvas);

    umbrellaButton.addEventListener('click', () => toggleTool('umbrella'));
    heaterButton.addEventListener('click', () => toggleTool('heater'));
    torchButton.addEventListener('click', () => toggleTool('torch'));

    document.getElementById('theme-tester').addEventListener('click', e => {
        if (e.target.tagNAme === 'BUTTON') {
            markUserInteraction();
            forceTheme(e.target.dataset.theme);
        }
    });
}

function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const setCanvasSize = (canvas) => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    };

    skyCanvas.width = window.innerWidth;
    skyCanvas.height = window.innerHeight;
    effectsCanvas.width = window.innerWidth;
    effectsCanvas.height = window.innerHeight;
    setCanvasSize(cardEffectsCanvas);
    forceTheme(currentTheme);
}

function handleMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    bodyEl.style.setProperty('--mouse-x', `${e.clientX}px`);
    bodyEl.style.setProperty('--mouse-y', `${e.clientY}px`);

    const cardRect = weatherCard.getBoundingClientRect();
    mouse.cardX = e.clientX - cardRect.left;
    mouse.cardY = e.clientY - cardRect.top;
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
    const url = `/api/weather?type=geo&city=${city}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('City not found.');
        const data = await response.json();
        if (data.length === 0) throw new Error(`Could not find city: ${city}`);
        const {lat, lon} = data[0];
        await fetchWeatherByCoords(lat, lon);
    }
    catch (error) {
        handleError(error.message);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    const url = `/api/weather?type=weather&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not fetch weather data.');
        const data = await response.json();
        const cityName = await fetchCityName(lat, lon);
        updateUI(data, cityName);
    }
    catch (error) {
        handleError(error.message);
    }   
}

async function fetchCityName(lat, lon) {
    const url = `/api/weather?type=reverseGeo&lat=${lat}&lon=${lon}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return 'Current Location';
        const data = await response.json();
        return data.length > 0 ? data[0].name : 'Current Location';
    }
    catch(error) {
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

    const iconName = getWeatherIconName(current.weather[0].id);
    icons.set("weather-icon", iconName);

    const theme = getThemeClass(iconName);
    forceTheme(theme);
    
    if (hourly && Array.isArray(hourly)) {
        renderHourlyForecast(hourly);
    } else {
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

function forceTheme(theme) {
    currentTheme = theme;
    bodyEl.className = `theme-${theme}`;

    stopAllSounds();
    particles = [];
    stars = [];
    clouds = [];
    frostLines = [];
    waterDroplets = [];
    cardEffectsCtx.clearRect(0, 0, cardEffectsCanvas.width, cardEffectsCanvas.height);
    
    createStars(theme === 'night' ? window.innerWidth / 8 : 0);
    createClouds(theme);
    
    if (theme === 'rainy') {
        if (userHasInteracted) rainSound.play().catch(e => {});
        createWeatherEffect('rainy');
        createCardDroplets();
    } else if (theme === 'snowy') {
        createWeatherEffect('snowy');
        createFrost();
    } else if (theme === 'thunderstorm') {
        if (userHasInteracted) thunderSound.play().catch(e => {});
    }
    updateToolsVisibility();
}

function getThemeClass(iconName) {
    if (iconName === 'CLEAR_DAY') return 'sunny';
    if (iconName === 'CLEAR_NIGHT') return 'night';
    if (iconName.includes('CLOUDY')) return 'cloudy';
    if (iconName === 'RAIN') return 'rainy';
    if (iconName === 'SNOW') return 'snowy';
    if (iconName === ('SLEET')) return 'thunderstorm';
    if (iconName === 'FOG') return 'misty';
    return 'cloudy';
}

function getWeatherIconName(weatherId) {
    const isDay = new Date().getHours() >= 6 && new Date().getHours() < 20;
    if (weatherId >= 200 && weatherId < 300) return 'SLEET';
    if (weatherId >= 300 && weatherId < 600) return 'RAIN';
    if (weatherId >= 600 && weatherId < 700) return 'SNOW';
    if (weatherId >= 700 && weatherId < 800) return 'FOG';
    if (weatherId === 800) return isDay ? 'CLEAR_DAY' : 'CLEAR_NIGHT';
    if (weatherId === 801 || weatherId === 802) return isDay ? 'PARTLY_CLOUDY_DAY' : 'PARTLY_CLOUDY_NIGHT';
    if (weatherId > 802) return 'CLOUDY';
    return 'CLOUDY';
}

function stopAllSounds(){
    allSounds.forEach(sound => {
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    });    
}

function toggleTool(tool) {
    if (tool === 'umbrella') isUmbrellaActive = !isUmbrellaActive;
    if (tool === 'heater') isHeaterActive = !isHeaterActive;
    if (tool === 'torch') isTorchActive = !isTorchActive;
    updateToolsVisibility(currentTheme);
}

function updateToolsVisibility(theme) {
    umbrellaButton.style.display = 'none';
    heaterButton.style.display = 'none';
    torchButton.style.display = 'none';

    if (theme === 'rainy' || theme === 'snowy') {
        umbrellaButton.style.display = 'block';
    }
    if (theme === 'snowy') {
        heaterButton.style.display = 'block';
    }
    if (theme === 'night') {
        torchButton.style.display = 'block';
    }

    umbrellaButton.classList.toggle('active', isUmbrellaActive);
    heaterButton.classList.toggle('active', isHeaterActive);
    torchButton.classList.toggle('active', isTorchActive);
    bodyEl.classList.toggle('torch-on', isTorchActive && theme === 'night');
}

function animate() {
    skyCtx.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
    effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);

    drawDynamicSky(skyCtx);
    drawSunorMoon(skyCtx);

    stars.forEach(s => {
        s.update();
        s.draw(skyCtx);
    });
    clouds.forEach(c => {
        c.update();
        c.draw(skyCtx);
    });
    particles.forEach(p => {
        p.update();
        p.draw(effectsCtx);
    });

    if (currentTheme === 'thunderstorm' && Math.random() > 0.995) {
        effectsCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        effectsCtx.fillRect(0, 0, effectsCanvas.width, effectsCanvas.height);
    }

    if (currentTheme === 'snowy') drawFrost();
    if (currentTheme === 'rainy') drawDroplets();

    requestAnimationFrame(animate);
}

function drawDynamicSky(ctx) {
    const hour = new Date().getHours();
    let topColor, bottomColor;

    if (hour > 20 || hour < 5) {
        topColor = '#0f1018';
        bottomColor = '#242B3E';
    } else if (hour < 7) {
        topColor = '#242B3E';
        bottomColor = '#7B8DAF';
    } else if (hour < 18) {
        topColor = '#4A85D3';
        bottomColor = '#AEC9E8';
    } else {
        topColor = '#7B8DAF'; bottomColor = '#E39A82'
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, skyCanvas.height);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
}

function drawSunorMoon(ctx) {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const sunrise = 6 * 60;
    const sunset = 20 * 60;

    ctx.save();
    if (totalMinutes > sunrise && totalMinutes < sunset) {
        const dayProgress = (totalMinutes - sunrise) / (sunset - sunrise);
        const x = skyCanvas.width * dayProgress;
        const y = skyCanvas.height * 0.6 - Math.sin(dayProgress * Math.PI) * (skyCanvas.height * 0.5);

        ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
        ctx.shadowColor = 'rgba(255, 255, 200, 1)';
        ctx.shadowBlur = 50;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.fill();
    } else {
        let nightProgress;
        if (totalMinutes >= sunset) {
            nightProgress = (totalMinutes - sunset) / ((24 * 60 - sunset) + sunrise);
        } else {
            nightProgress = (totalMinutes + (24 * 60 - sunset)) / ((24 * 60 - sunset) + sunrise);
        }
        const x = skyCanvas.width * nightProgress;
        const y = skyCanvas.height * 0.7 - Math.sin(nightProgress * Math.PI) * (skyCanvas.height * 0.6);

        ctx.fillStyle = 'rgba(230, 230, 240, 0.9)';
        ctx.shadowColor = 'rgba(230, 230, 240, 1)';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x, y, 40, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

class Cloud {
    constructor() {
        this.x = Math.random() * skyCanvas.width;
        this.y = Math.random() * (skyCanvas.height * 0.4);
        this.size = Math.random() * 50 + 50;
        this.speed = Math.random() * 0.2 + 0.1;
        this.opacity = Math.random() * 0.3 + 0.2;
    }
    update() {
        this.x += this.speed;
        if (this.x > skyCanvas.width + this.size) this.x = -this.size;
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.6, 0, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function createClouds(theme) {
    clouds = [];
    let cloudCount = 0;
    if (theme === 'cloudy' || theme === 'misty') cloudCount = 25;
    if (theme === 'rainy' || theme === 'thunderstorm') cloudCount = 40;
    if (theme === 'sunny' || theme === 'night') cloudCount = 10;
    for (let i = 0; i < cloudCount; i++) clouds.push(new Cloud());
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
        
        if (isUmbrellaActive && (currentTheme === 'rainy' || currentTheme === 'snowy')) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                this.x -= (dx / distance) * force * 15;
                this.y -= (dy / distance) * force * 15;
            }
        }
        if (this.y > effectsCanvas.height + this.size) {
            this.y = -this.size;
            this.x = Math.random() * effectsCanvas.width;
        }
    }
}

class RainDrop extends Particle {
    draw() {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.speedX * 2, this.y + this.speedY * 2);
        ctx.stroke();
    }
}

class Snowflake extends Particle {
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createWeatherEffect(type) {
    particles = [];
    let particleCount = type === 'rainy' ? 500 : 150;

    for (let i = 0; i < particleCount; i++) {
        let x = Math.random() * effectsCanvas.width;
        let y = Math.random() * effectsCanvas.height;
        
        if (type === 'rainy') {
            particles.push(new RainDrop(x, y, 1, 1, Math.random() * 5 + 8));
        } else {
            particles.push(new Snowflake(x, y, Math.random() * 2 + 1, Math.random() * 0.5 - 0.25, Math.random() * 1 + 0.5));
        }
    }
}

class Star {
    constructor() {
        this.x = Math.random() * skyCanvas.width;
        this.y = Math.random() * skyCanvas.height;
        this.radius = Math.random() * 1.5;
        this.alpha = Math.random() * 0.5 + 0.5;
        this.twinkleSpeed = Math.random() * 0.015;
    }

    draw(ctx) {
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
        if (this.alpha > 1 || this.alpha < 0.3) this.twinkleSpeed *= -1;
    }
}

function createStars() {
    stars = [];
    for (let i = 0; i < count; i++) stars.push(new Star());
}

function createFrost() {
    frostLines = [];
    const dpr = window.devicePixelRatio || 1;
    const startPoints = 10;
    for (let i = 0; i < startPoints; i++) {
        frostLines.push({
            x: Math.random() * cardEffectsCanvas.width / dpr,
            y: Math.random() * cardEffectsCanvas.height / dpr,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.2 + 0.1,
            life: 100 + Math.random() * 100
        });
    }
}

function drawFrost() {
    if (Math.random() > 0.3) {
        frostLines.forEach(line => {
            if (line.life > 0) {
                cardEffectsCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                cardEffectsCtx.lineWidth = 1;
                cardEffectsCtx.beginPath();
                cardEffectsCtx.moveTo(line.x, line.y);
                line.x += Math.cos(line.angle) * line.speed;
                line.y += Math.sin(line.angle) * line.speed;
                cardEffectsCtx.lineTo(line.x, line.y);
                cardEffectsCtx.stroke();

                line.angle += (Math.random() - 0.5) * 0.5;
                if (Math.random() > 0.99) {
                    frostLines.push({...line, angle: line.angle + (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2});
                }
                line.life--;
            }
        });
    }

    if (mouse.cardX && isHeaterActive) {
        cardEffectsCtx.save();
        const dpr = window.devicePixelRatio || 1;
        const radius = 30;
        if (isHeaterActive) {
            const gradient = cardEffectsCtx.createRadialGradient(mouse.cardX, mouse.cardY, 0, mouse.cardX, mouse.cardY, radius * 1.5);
            gradient.addColorStop(0, 'rgba(252, 74, 26, 0.2)');
            gradient.addColorStop(1, 'rgba(252, 74, 26, 0)');
            cardEffectsCtx.fillStyle = gradient;
            cardEffectsCtx.fillRect(0, 0, cardEffectsCanvas.width / dpr, cardEffectsCanvas.height / dpr);
        }
        cardEffectsCtx.globalCompositeOperation = 'destination-out';
        cardEffectsCtx.beginPath();
        cardEffectsCtx.ard(mouse.cardX, mouse.cardY, radius, 0, Math.PI * 2);
        cardEffectsCtx.fill();
        cardEffectsCtx.restore();
    }
}
//s
function createCardDroplets() {
    const dpr = window.devicePixelRatio || 1;
    waterDroplets = [];
    for (let i = 0; i < 30; i++) {
        waterDroplets.push({
            x: Math.random() * cardEffectsCanvas.width / dpr,
            y: Math.random() * cardEffectsCanvas.height / dpr;
            r: Math.random() * 1.5 + 1,
            speed: Math.random() * 0.5 + 0.2,
            life: Math.random() * 50
        });
    }
}

function drawDroplets() {
    cardEffectsCtx.clearRect(0, 0, cardEffectsCanvas.width, cardEffectsCanvas.height);
    waterDroplets.forEach(d => {
        cardEffectsCtx.beginPath();
        cardEffectsCtx.fillStyle = 'rgba(200, 210, 220, 0.4)';
        cardEffectsCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        cardEffectsCtx.fill();

        d.y += d.speed;
        d.life--;
        if (d.y > cardEffectsCanvas.height || d.life <= 0) {
            d.y = 0;
            d.x = Math.random() * cardEffectsCanvas.width;
            d.life = Math.random() * 50;
        }
    });
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

function drawLightning() {
    if (Math.random() > 0.99) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function setThemeAndSound(weatherId) {
    const iconName = getWeatherIconName(weatherId);
    icons.set("weather-icon", iconName);
    const theme = getThemeClass(iconName).replace('theme-', '');
    forceTheme(theme);
}

