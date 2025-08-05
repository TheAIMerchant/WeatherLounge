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
const dpr = window.devicePixelRatio || 1;

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
let shootingStars = [];
let clouds = [];
let frostLines = [];
let meltDrips = [];
let heatTrail = [];
let currentHeatPoint = {x: 0, y: 0, intensity: 0};
let celestialBodyPosition = {x: 0, y: 0};
let userHasInteracted = false;
let isUmbrellaActive = false;
let isHeaterActive = false;
let isTorchActive = false;
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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', setupCanvas);

    umbrellaButton.addEventListener('click', () => toggleTool('umbrella'));
    heaterButton.addEventListener('click', () => toggleTool('heater'));
    torchButton.addEventListener('click', () => toggleTool('torch'));

    document.getElementById('theme-tester').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            markUserInteraction();
            forceTheme(e.target.dataset.theme);
        }
    });
}

function setupCanvas() {
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
    showLoader();
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

function updateToolsVisibility() {
    const theme = document.body.className. replace('theme-', '').split(' ')[0];

    umbrellaButton.style.display = 'block';
    heaterButton.style.display = 'block';
    torchButton.style.display = 'block';
    
    umbrellaButton.classList.toggle('active', isUmbrellaActive);
    heaterButton.classList.toggle('active', isHeaterActive);
    torchButton.classList.toggle('active', isTorchActive);
    bodyEl.classList.toggle('torch-on', isTorchActive);
}

function animate() {
    skyCtx.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
    effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);

    drawDynamicSky(skyCtx);
    drawSunorMoon(skyCtx);
    drawUmbrellaShade(effectsCtx);

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
    if (currentTheme === 'night') {
        if (Math.random() < 0.01 && shootingStars.length < 3) {
            shootingStars.push(new shootingStar());
        }
        shootingStars.forEach((star, index) => {
            star.update();
            star.draw(skyCtx);
            if (!star.active) {
                shootingStars.splice(index, 1);
            }
        });
    }

    drawCardEffects();
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
        celestialBodyPosition = {x, y};

        ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
        ctx.shadowColor = 'rgba(255, 255, 200, 1)';
        ctx.shadowBlur = 80;
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
        const x_moon = skyCanvas.width * nightProgress;
        const y_moon = skyCanvas.height * 0.7 - Math.sin(nightProgress * Math.PI) * (skyCanvas.height * 0.6);

        celestialBodyPosition = {x: x_moon, y: y_moon};

        ctx.fillStyle = 'rgba(230, 230, 240, 0.9)';
        ctx.shadowColor = 'rgba(230, 230, 240, 1)';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x_moon, y_moon, 40, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawUmbrellaShade(ctx) {
    if (!isUmbrellaActive || currentTheme !== 'sunny' || mouse.x === undefined) {
        return;
    }

    const dx = mouse.x - celestialBodyPosition.x;
    const dy = mouse.y - celestialBodyPosition.y;
    const angle = Math.atan2(dy, dx);
    const sunHeightFactor = 1 - (celestialBodyPosition.y / (skyCanvas.height * 0.7));
    const shadowLength = 200 * sunHeightFactor;
    const shadowCenterX = mouse.x + Math.cos(angle) * (shadowLength / 2);
    const shadowCenterY = mouse.y + Math.sin(angle) * (shadowLength / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 10, 30, 0.25)';
    ctx.beginPath();
    ctx.ellipse(shadowCenterX, shadowCenterY, shadowLength / 2, 75, angle, 0, Math.PI * 2);
    ctx.fill();
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
    if (theme === 'cloudy' || theme === 'misty' || theme === 'snowy') cloudCount = 25;
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

        if (isUmbrellaActive && (currentTheme === 'rainy' || currentTheme === 'snowy') && mouse.x !== undefined) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            let shelterRadius = 150;
            
            if (distance < shelterRadius) {
                const force = (shelterRadius - distance) / shelterRadius;
                const pushStrength = 15;
                this.x -= (dx / distance) * force * pushStrength;
                this.y -= (dy / distance) * force * pushStrength;
            }
        }
        
        if (this.y > effectsCanvas.height + this.size) {
            this.y = -this.size;
            this.x = Math.random() * effectsCanvas.width;
        }
    }
}

class RainDrop extends Particle {
    draw(ctx) {
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

function drawCardEffects() {
    cardEffectsCtx.clearRect(0, 0, cardEffectsCanvas.width, cardEffectsCanvas.height);
    if (currentTheme === 'snowy') {
        drawFrost();
    }
    if (isHeaterActive) {
        drawCardHeat();
    }
}

function drawCardHeat() {
    let heatMultiplier = 1.0;
    if (currentTheme === 'sunny') heatMultiplier = 1.5;
    else if (currentTheme === 'cloudy') heatMultiplier = 1.2;
    
    const cardRect = weatherCard.getBoundingClientRect();
    const isMouseOverCard = mouse.x > cardRect.left && mouse.x < cardRect.right && mouse.y > cardRect.top && mouse.y < cardRect.bottom;

    if (isHeaterActive && isMouseOverCard) {
        currentHeatPoint.x = mouse.cardX;
        currentHeatPoint.y = mouse.cardY;
        currentHeatPoint.intensity = Math.min(1.0, currentHeatPoint.intensity + (0.04 * heatMultiplier));
        if (heatTrail.length === 0 || Math.hypot(currentHeatPoint.x - heatTrail[heatTrail.length-1].x, currentHeatPoint.y - heatTrail[heatTrail.length-1].y) > 5) {
            heatTrail.push({...currentHeatPoint});
        } else {
            currentHeatPoint.intensity = Math.max(0, currentHeatPoint.intensity - 0.03);
        }

        cardEffectsCtx.globalCompositeOperation = 'lighter';

        if (currentHeatPoint.intensity > 0) {
            const glowRadius = 30 * currentHeatPoint.intensity;
            const gradient = cardEffectsCtx.createRadialGradient(currentHeatPoint.x, currentHeatPoint.y, 0, currentHeatPoint.x, currentHeatPoint.y, glowRadius);
            gradient.addColorStop(0, `rgba(255, 120, 0, ${0.6 * currentHeatPoint.intensity})`);
            gradient.addColorStop(0.5, `rgba(255, 60, 0, ${0.3 * currentHeatPoint.intensity})`);
            gradient.addColorStop(1, 'rgba(252, 74, 26, 0');

            cardEffectsCtx.fillStyle = gradient;
            cardEffectsCtx.beginPath();
            cardEffectsCtx.arc(currentHeatPoint.x, currentHeatPoint.y, glowRadius, 0, Math.PI * 2);
            cardEffectsCtx.fill();
        }

        cardEffectsCtx.lineCap = 'round';
        cardEffectsCtx.lineJoin = 'round';
        for (let i = 1; i < heatTrail.length; i++) {
            const point = heatTrail[i];
            const prevPoint = heatTrail[i - 1];
            cardEffectsCtx.strokeStyle = `rgba(255, 100, 50, ${0.4 * point.intensity})`;
            cardEffectsCtx.lineWidth = 15 * point.intensity;
            cardEffectsCtx.beginPath();
            cardEffectsCtx.moveTo(prevPoint.x, prevPoint.y);
            cardEffectsCtx.lineTo(point.x, point.y);
            cardEffectsCtx.stroke();
        }

        cardEffectsCtx.globalCompositeOperation = 'source-over';

        for (let i = heatTrail.length - 1; i >= 0; i--) {
            heatTrail[i].intensity -= 0.02;
            if (heatTrail[i].intensity <= 0) {
                heatTrail.splice(i, 1);
            }
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

function createStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) stars.push(new Star());
}

class MeltDrip {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = 2.0;
        this.speedY = Math.random() * 0.5 + 0.2;
        this.gravity = 0.02;
        this.life = 150;
    }
    update() {
        this.speedY += this.gravity;
        this.y += this.speedY;
        this.life--;
    }
    draw(ctx) {
        const opacity = Math.min(1, this.life / 100);
        const streakLength = this.r * 5;
        const gradient = ctx.createLinearGradient(this.x, this.y - streakLength, this.x, this.y);
        gradient.addColorStop(0, `rgba(210, 220, 235, 0)`);
        gradient.addColorStop(1, `rgba(210, 220, 235, ${0.6 * opacity})`);

        ctx.strokeStyle = gradient;
        ctx.linewidth = this.r * 0.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - streakLength);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
    }
}

class FrostCrystal {
    constructor(x, y, angle, ctx) {
        this.path = [{x, y}];
        this.angle = angle;
        this.speed = Math.random() * 0.3 + 0.1;
        this.life = 100 + Math.random() * 150;
        this.isFrozen = true;
        this.meltTimer = 0;
        this.canvasRect = ctx.canvas.getBoundingClientRect();
    }
    update(ctx, mouse, heatRadius, isHeaterActive) {
        const lastPoint = this.path[this.path.length - 1];
        if (isHeaterActive && mouse.cardX !== undefined) {
            const dx = lastPoint.x - mouse.cardX;
            const dy = lastPoint.y - mouse.cardY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < heatRadius && this.isFrozen) {
                this.isFrozen = false;
                this.meltTimer = 120;
                if (this.path.length > 1 && Math.random() > 0.8) {
                    meltDrips.push(new MeltDrip(lastPoint.x, lastPoint.y));
                }
            }
        }
        if (!this.isFrozen) {
            if (this.path.length > 1) {
                this.path.pop();
            }
            this.meltTimer--;
            if (this.meltTimer <= 0 && this.path.length < 5) {
                this.isFrozen = true;
            }
        } else if(this.life > 0) {
            const newX = lastPoint.x + Math.cos(this.angle) * this.speed;
            const newY = lastPoint.y + Math.sin(this.angle) * this.speed;
            if (newX < 0 || newX > this.canvasRect.width / dpr || newY < 0 || newY > this.canvasRect.height / dpr) {
                this.life = 0;
            } else {
                this.path.push({x: newX, y: newY});
                this.life--;
                this.angle += (Math.random() - 0.5) * 0.6;
                if (Math.random() > 0.985 && frostLines.length < 400) {
                    const branchAngle = this.angle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2) * (Math.random() * 0.5 + 0.5);
                    frostLines.push(new FrostCrystal(newX, newY,branchAngle, ctx));
                }
            }
        }
    }
    draw(ctx) {
        if (this.path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }
}

function createFrost() {
    frostLines = [];
    if (!cardEffectsCanvas) return;
    const {width, height} = cardEffectsCanvas.getBoundingClientRect();
    const startPoints = 25;
    for (let i = 0; i < startPoints; i++) {
        let x, y, angle;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) {
            x = 0;
            y = Math.random() * height;
            angle = Math.random() * Math.PI - Math.PI / 2;
        } else if (side === 1) {
            x = width;
            y = Math.random() * height;
            angle = Math.random() * Math.PI  + Math.PI / 2;
        } else if (side === 2) {
            x = Math.random() * width;
            y = 0;angle = Math.random() * Math.PI;
        } else {
            x = Math.random() * width;
            y = height;
            angle = Math.random() * Math.PI - Math.PI;
        }
        frostLines.push(new FrostCrystal(x, y, angle, cardEffectsCtx));
    }
}

function drawFrost() {
    let heatMultiplier = 1.0;
    if (currentTheme === 'sunny') heatMultiplier = 1.5;
    else if (currentTheme === 'cloudy') heatMultiplier = 1.2;

    frostLines.forEach(crystal => {
        crystal.update(cardEffectsCtx, mouse, 45, isHeaterActive);
        crystal.draw(cardEffectsCtx);
    });

    meltDrips.forEach((drip, index) => {
        drip.update();
        drip.draw(cardEffectsCtx);
        if (drip.y > cardEffectsCanvas.height / dpr || drip.life <= 0) {
            meltDrips.splice(index, 1);
        }
    });
}

class shootingStar {
    constructor() {
        this.reset();        
    }
    reset() {
        this.x = Math.random() * effectsCanvas.width;
        this.y = 0;
        this.len = Math.random() * 80 + 10;
        this.speed = Math.random() * 10 + 6;
        this.active = true;
    }
    update() {
        if (this.active) {
            this.x -= this.speed;
            this.y += this.speed;
            if (this.x < 0 || this.y > effectsCanvas.height) {
                this.active = false;
            }
        }
    }
    draw(ctx) {
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