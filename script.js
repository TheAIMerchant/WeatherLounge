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
const THEME_WARMTH = {
    sunny: 3,
    cloudy: 2,
    misty: 1,
    rainy: 1,
    thunderstorm: 1,
    night: 1,
    snowy: 0
};

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

let appState = {
    theme: '',
    previousTheme: '',
    isTransitioning: false,
    transitionStartTime: 0,
    transitionDuration: 5000,
    timeOfDay: 0,
    targetTimeOfDay: 0,
    skyColors: {top: '#000', bottom: '#000'},
    targetSkyColors: {top: '#000', bottom: '#000'},
    sun: {x: 0, y: 0, size: 50 },
    moon: {x: 0, y: 0, size: 40},
    celestialBodyPositions: {
        sunStartY: 0, sunEndY: 0,
        moonStartY: 0, moonEndY: 0,
    },
    activeWeatherEffect: 'none',
};

let particles = [];
let stars = [];
let shootingStars = [];
let clouds = [];
let lightningBolts = [];
let frostLines = [];
let globalMeltDrips = [];
let heatTrail = [];
let currentHeatPoint = {x: 0, y: 0, intensity: 0};

let userHasInteracted = false;
let isUmbrellaActive = false;
let isHeaterActive = false;
let isTorchActive = false;
const mouse = {x: undefined, y: undefined, radius: 300};
let moonTextureCanvas;

window.addEventListener('DOMContentLoaded', () => {
    moonTextureCanvas = createMoonTexture(128);
    setupCanvases();
    addEventListeners();
    setTheme('night', true);
    animate();
});

function addEventListeners() {
    searchButton.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') handleSearch();
    });
    geoButton.addEventListener('click', handleGeolocation);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', setupCanvases);

    umbrellaButton.addEventListener('click', () => toggleTool('umbrella'));
    heaterButton.addEventListener('click', () => toggleTool('heater'));
    torchButton.addEventListener('click', () => toggleTool('torch'));

    document.getElementById('theme-tester').addEventListener('click', e => {
        const button = e.target.closest('button');
        if (button) {
            markUserInteraction();
            setTheme(button.dataset.theme);
        }
    });
}

function setupCanvases() {
    const setCanvasSize = (canvas, ctx) => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    };

    skyCanvas.width = window.innerWidth;
    skyCanvas.height = window.innerHeight;
    effectsCanvas.width = window.innerWidth;
    effectsCanvas.height = window.innerHeight;
    setCanvasSize(cardEffectsCanvas, cardEffectsCtx);
}

function handleMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    bodyEl.style.setProperty('--mouse-x', `${e.clientX}px`);
    bodyEl.style.setProperty('--mouse-y', `${e.clientY}px`);

    const cardRect = weatherCard.getBoundingClientRect();
    mouse.cardX = (e.clientX - cardRect.left);
    mouse.cardY = (e.clientY - cardRect.top);
}

// API & Data handling
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

function showLoader() {
    cardContent.classList.add('loading');
    loader.style.display = 'block';
}

function hideLoader() {
    cardContent.classList.remove('loading');
    loader.style.display = 'none';
}

function markUserInteraction() {
    if (!userHasInteracted) {
        userHasInteracted = true;
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

    const iconName = getWeatherIconName(current.weather[0].id, current.dt);
    icons.set("weather-icon", iconName);

    const theme = getThemeFromIcon(iconName);
    const cityTime = new Date((current.dt + weatherData.timezone_offset) * 1000);
    setTheme(theme, false, cityTime);
    
    renderHourlyForecast(hourly || []);
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
        icons.set(iconID, getWeatherIconName(hour.weather[0].id, hour.dt));
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

function setTheme(theme, instant = false, dt = null) {
    if (appState.theme === theme && !instant) return;

    appState.previousTheme = appState.theme;
    appState.theme = theme;

    if (appState.previousTheme === 'snowy' && appState.theme !== 'snowy') {
        const meltSpeed = THEME_WARMTH[appState.theme] || 1;
        setTimeout(() => {
            frostLines.forEach(crystal => {
                crystal.autoMeltSpeed = meltSpeed;
            });    
        }, 1000);
        
    } else if (appState.theme === 'snowy' && appState.previousTheme !== 'snowy') {
        frostLines = [];
        createFrost();
    }

    if (isNight(theme) && stars.length === 0) {
        createStars(window.innerWidth / 8);
    }

    createClouds(appState.theme);

    const colors = {
        sunny: {top: '#4A85D3', bottom: '#AEC9E8'},
        cloudy: {top: '#78909C', bottom: '#CFD8DC'},
        rainy: {top: '#455A64', bottom: '#78909C'},
        thunderstorm: {top: '#263238', bottom: '#455A64'},
        snowy: {top: '#B0BEC5', bottom: '#242B3E'},
        night: {top: '#0f1018', bottom: '#242B3E'},
        misty: {top: '#B0BEC5', bottom: '#CFD8DC'},
        sunset: {top: '#F79D51', bottom: '#F27164'},
    };

    const date = dt || new Date();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    appState.targetTimeOfDay = (hours * 60 + minutes) / (24 * 60);

    if (Math.abs(appState.targetTimeOfDay - appState.timeOfDay) > 0.5) {
        if (appState.timeOfDay > appState.targetTimeOfDay) {
            appState.targetTimeOfDay += 1.0;
        } else {
            appState.timeOfDay += 1.0;
        }
    }

    if (instant) {
        appState.timeOfDay = appState.targetTimeOfDay;
        appState.skyColors = {...colors[theme]};
        appState.targetSkyColors = {...colors[theme]};
        appState.isTransitioning = false;
        finaliseThemeChange();
    } else {
        appState.isTransitioning = true;
        appState.transitionStartTime = performance.now();
        appState.targetSkyColors = {...colors[theme]};
    }
    bodyEl.className = `theme-${theme}`;
    updateToolsVisibility(); 
}

function finaliseThemeChange() {
    stopAllSounds();
    lightningBolts = [];

    appState.activeWeatherEffect = 'none';

    switch (appState.theme) {
        case 'rainy':
        case 'thunderstorm':
            appState.activeWeatherEffect = 'rainy';
            fadeSound(rainSound, 0.5, 2000);
            if (appState.theme === 'thunderstorm') fadeSound(thunderSound, 0.6, 2000);
            break;
        case 'snowy':
            appState.activeWeatherEffect = 'snowy';
            break;
    }
}

function isNight(theme) {
    return theme === 'night';
}

function getThemeFromIcon(iconName) {
    if (iconName === 'CLEAR_DAY') return 'sunny';
    if (iconName === 'CLEAR_NIGHT') return 'night';
    if (iconName.includes('CLOUDY')) return 'cloudy';
    if (iconName === 'RAIN') return 'rainy';
    if (iconName === 'SNOW') return 'snowy';
    if (iconName === 'SLEET') return 'thunderstorm';
    if (iconName === 'FOG') return 'misty';
    return 'cloudy';
}

function getWeatherIconName(weatherId, dt) {
    const date = new Date(dt * 1000);
    const hours = date.getHours();
    const isDay = hours >= 6 && hours < 20;

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
    allSounds.forEach(sound => fadeSound(sound, 0, 500));    
}

function fadeSound(audio, targetVolume, duration) {
    if (!userHasInteracted && targetVolume > 0) return;
    if (targetVolume > 0 && audio.paused) audio.play().catch(() => {});

    const startVolume = audio.volume;
    const startTime = performance.now();

    function animateFade() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        audio.volume = lerp(startVolume, targetVolume, progress);
        if (progress < 1) {
            requestAnimationFrame(animateFade);
        } else {
            if (targetVolume === 0) {
                audio.pause();
                audio.currentTime = 0;
            }
        }
    }
    animateFade();
}

function toggleTool(tool) {
    if (tool === 'umbrella') isUmbrellaActive = !isUmbrellaActive;
    if (tool === 'heater') isHeaterActive = !isHeaterActive;
    if (tool === 'torch') isTorchActive = !isTorchActive;
    updateToolsVisibility(appState.theme);
}

function updateToolsVisibility() {
    umbrellaButton.style.display = 'block';
    heaterButton.style.display = 'block';
    torchButton.style.display = 'block';
    
    umbrellaButton.classList.toggle('active', isUmbrellaActive);
    heaterButton.classList.toggle('active', isHeaterActive);
    torchButton.classList.toggle('active', isTorchActive);
    bodyEl.classList.toggle('torch-on', isTorchActive);
}

function animate(timestamp) {
    skyCtx.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
    effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);

    let transitionProgress = 1.0;
    if (appState.isTransitioning) {
        const elapsed = timestamp - appState.transitionStartTime;
        transitionProgress = Math.min(elapsed / appState.transitionDuration, 1.0);
        appState.timeOfDay = lerp(appState.timeOfDay, appState.targetTimeOfDay, 0.05);

        if (appState.timeOfDay >= 1.0) {
            appState.timeOfDay -= 1.0;
            appState.targetTimeOfDay -= 1.0;
        }

        if (transitionProgress >= 1.0) {
            appState. isTransitioning = false;
            appState.skyColors = {...appState.targetSkyColors};
            finaliseThemeChange();
        }
    }

    drawDynamicSky(transitionProgress);
    drawStars(transitionProgress);
    drawShootingStars();
    drawCelestialBodies(transitionProgress);
    drawClouds(transitionProgress);

    handleWeatherEffects();
    drawParticles();
    drawLightning();
    drawMeltDrips();
    drawUmbrellaShade(effectsCtx);
    drawCardEffects();

    requestAnimationFrame(animate);
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function lerpRgb(c1, c2, amt) {
    const [r1, g1, b1] = c1.split(',').map(Number);
    const [r2, g2, b2] = c2.split(',').map(Number);
    const r = Math.round(lerp(r1, r2, amt));
    const g = Math.round(lerp(g1, g2, amt));
    const b = Math.round(lerp(b1, b2, amt));
    return `${r}, ${g}, ${b}`;
}

function lerpColor(c1, c2, amt) {
    const [r1, g1, b1] = c1.match(/\w\w/g).map(h => parseInt(h, 16));
    const [r2, g2, b2] = c2.match(/\w\w/g).map(h => parseInt(h, 16));
    const r = Math.round(lerp(r1, r2, amt));
    const g = Math.round(lerp(g1, g2, amt));
    const b = Math.round(lerp(b1, b2, amt));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function drawDynamicSky(progress) {
    const c1 = appState.isTransitioning ? appState.skyColors.top : appState.targetSkyColors.top;
    const c2 = appState.isTransitioning ? appState.skyColors.bottom : appState.targetSkyColors.bottom;
    
    const topColor = lerpColor(c1, appState.targetSkyColors.top, progress);
    const bottomColor = lerpColor(c2, appState.targetSkyColors.bottom, progress);

    const gradient = skyCtx.createLinearGradient(0, 0, 0, skyCanvas.height);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);

}

function drawCelestialBodies() {
    skyCtx.save();

    const time = appState.timeOfDay % 1.0;
    const angle = time * Math.PI * 2 + (Math.PI / 2);

    const centerX = skyCanvas.width / 2;
    const centerY = skyCanvas.height * 1.0;

    const radiusX = skyCanvas.width / 2 + 100;
    const radiusY = skyCanvas.height * 0.9;

    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;

    if (y < centerY) {
        appState.sun.x = x;
        appState.sun.y = y;

        const sunGradient = skyCtx.createRadialGradient(appState.sun.x, appState.sun.y, 0, appState.sun.x, appState.sun.y, appState.sun.size * 1.5);
        sunGradient.addColorStop(0, 'rgba(255, 255, 245, 1)');
        sunGradient.addColorStop(0.5, 'rgba(255, 255, 220, 0.9)');
        sunGradient.addColorStop(1, 'rgba(255, 220, 180, 0)');
        skyCtx.fillStyle = sunGradient;
        skyCtx.beginPath();
        skyCtx.arc(appState.sun.x, appState.sun.y, appState.sun.size * 1.5, 0, Math.PI * 2);
        skyCtx.fill();
    }
    const moonAngle = angle + Math.PI;
    const moonX = centerX + Math.cos(moonAngle) * radiusX;
    const moonY = centerY + Math.sin(moonAngle) * radiusY;

    if (moonY < centerY) {
        appState.moon.x = moonX;
        appState.moon.y = moonY;
        skyCtx.shadowColor = 'rgba(230, 230, 240, 0.7)';
        skyCtx.shadowBlur = 30;
        skyCtx.drawImage(moonTextureCanvas, appState.moon.x - appState.moon.size, appState.moon.y - appState.moon.size, appState.moon.size * 2, appState.moon.size * 2);
    }
    skyCtx.restore();
}

function createMoonTexture(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(230, 230, 240, 0.9)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i< 50; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * (size / 20) + 1;
        if (Math.hypot(x - size / 2, y - size / 2) < size / 2 - r) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    return canvas;
}

function drawUmbrellaShade(ctx) {
    if (!isUmbrellaActive || appState.theme !== 'sunny' || mouse.x === undefined || appState.sun.y <= 0) {
        return;
    }

    const dx = mouse.x - appState.sun.x;
    const dy = mouse.y - appState.sun.y;
    const angle = Math.atan2(dy, dx);
    const sunHeightFactor = Math.max(0, 1 - (appState.sun.y / (skyCanvas.height * 0.7)));
    const shadowLength = 300 * sunHeightFactor;

    ctx.save();

    for (let i = 0; i < 5; i++) {
        const progression = i / 4;
        const offsetX = Math.cos(angle) * (shadowLength * progression);
        const offsetY = Math.sin(angle) * (shadowLength * progression);
        const radiusX = 100 - (progression * 50);
        const radiusY = 75 - (progression * 40);

        ctx.fillStyle = `rgba(0, 10, 30, ${0.05 * (1 - progression)})`;
        ctx.beginPath();
        ctx.ellipse(mouse.x + offsetX, mouse.y + offsetY, radiusX, radiusY, angle, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function getCloudColorSet(theme, isHeavy) {
    let color = isHeavy ? '200, 205, 210' : '255, 255, 255';
    let opacity = isHeavy ? 0.85 : 0.7;

    switch (theme) {
        case 'night':
            color = isHeavy ? '45, 50, 60' : '65, 70, 80';
            opacity = isHeavy ? 0.8 : 0.65;
            break;
        case 'rainy':
            color = isHeavy ? '80, 90, 100' : '110, 115, 120';
            opacity = isHeavy ? 0.9 : 0.75;
            break;
        case 'thunderstorm':
            color = isHeavy ? '50, 55, 65' : '70, 75, 85';
            opacity = isHeavy ? 0.95 : 0.8;
            break;
        case 'snowy':
             color = isHeavy ? '180, 185, 190' : '220, 225, 230';
             opacity = 0.85;
            break;
    }
    return { color, opacity };
}

class Cloud {
    constructor(yPosition, isHeavy, shouldFadeIn = false) {
        this.y = yPosition;
        this.isHeavy = isHeavy;
        this.speed = (Math.random() * 0.3 + 0.2) * (this.isHeavy ? 1.5 : 1.0);
        this.puffs = [];

        this.alpha = shouldFadeIn ? 0 : 1.0;
        this.isFadingIn = shouldFadeIn;
        this.isFadingOut = false;

        const cloudWidth = (Math.random() * 200 + 150) * (this.isHeavy ? 1.2 : 1.0);
        const cloudHeight = cloudWidth * (Math.random() * 0.3 + 0.4);
        this.x = Math.random() * skyCanvas.width;

        const puffCount = Math.floor(Math.random() * 5 + 8);
        for (let i = 0; i < puffCount; i++) {
            this.puffs.push({
                offsetX: (Math.random() - 0.5) * cloudWidth,
                offsetY: (Math.random() - 0.5) * cloudHeight,
                radius: (Math.random() * 0.4 + 0.6) * (cloudWidth / 3.5),
            });
        }
    }

    update() {
        this.x += this.speed;

        if (this.isFadingIn) {
            this.alpha = Math.min(1.0, this.alpha + 0.005);
            if (this.alpha >= 1.0) {
                this.isFadingIn = false;
            }
        } else if (this.isFadingOut) {
            this.alpha -= 0.003;
        }

        if (this.x > skyCanvas.width + 300) {
            this.x = -300;
        }
    }

    draw(ctx, transitionProgress) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        let baseColor, baseOpacity;

        if (appState.isTransitioning && appState.previousTheme) {
            const startSet = getCloudColorSet(appState.previousTheme, this.isHeavy);
            const targetSet = getCloudColorSet(appState.theme, this.isHeavy);
            baseColor = lerpRgb(startSet.color, targetSet.color, transitionProgress);
            baseOpacity = lerp(startSet.opacity, targetSet.opacity, transitionProgress);
        } else {
            const currentSet = getCloudColorSet(appState.theme, this.isHeavy);
            baseColor = currentSet.color;
            baseOpacity = currentSet.opacity;
        }

        this.puffs.forEach(puff => {
            const puffX = this.x + puff.offsetX;
            const puffY = this.y + puff.offsetY;
            const radius = puff.radius;
            const gradient = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, radius);
            

            gradient.addColorStop(0, `rgba(${baseColor}, ${baseOpacity * 0.5})`);
            gradient.addColorStop(1, `rgba(${baseColor}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(puffX, puffY, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, size, speedX, speedY) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.speedX = speedX;
        this.speedY = speedY;
        this.life = 1.0;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        const isRainyTheme = appState.theme === 'rainy' || appState.theme === 'thunderstorm';

        if (isUmbrellaActive && particles.length > 0 && mouse.x !== undefined) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.hypot(dx, dy);
            let shelterRadius = 150;
            
            if (distance < shelterRadius) {
                const force = (shelterRadius - distance) / shelterRadius;
                const pushStrength = 15;
                this.x -= (dx / distance) * force * pushStrength;
                this.y -= (dy / distance) * force * pushStrength;
            }
        }
        
        if (this.y > effectsCanvas.height + this.size) {
            this.life = 0;
        }
    }
}

class RainDrop extends Particle {
    draw(ctx) {
        ctx.strokeStyle = `rgba(174, 194, 224, ${0.5 * this.life})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.speedX * 2, this.y + this.speedY * 2);
        ctx.stroke();
    }
}

class Snowflake extends Particle {
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * this.life})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class LightningBolt {
    constructor(x, y, angle, depth = 0) {
        this.path = [{x, y}];
        this.angle = angle;
        this.speed = Math.random() * 20 + 15;
        this.life = 1.0;
        this.branches = [];
        this.depth = depth;
        this.isGenerated = false;
        this.generationSteps = 60;
    }

    extend() {
        if (this.isGenerated) {
            this.branches.forEach(b => b.extend());
            return;
        }

        let lastPoint = this.path[this.path.length - 1];
        const newX = lastPoint.x + Math.cos(this.angle) * this.speed;
        const newY = lastPoint.y + Math.sin(this.angle) * this.speed;

        if (newY > skyCanvas.height + 50 || this.path.length >= this.generationSteps) {
            this.isGenerated = true;
            return;
        }

        this.path.push({x: newX, y: newY});
        this.angle += (Math.random() - 0.5) * 0.8;

        if (Math.random() > 0.96 && this.depth < 3) {
            const branchAngle = this.angle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 3);
            const newBranch = new LightningBolt(newX, newY, branchAngle, this.depth + 1);
            this.branches.push(newBranch);
        }
    }

    update() {
        this.life -= 0.02;
    }

    draw(ctx) {
        if (this.path.length < 2 || this.life <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.life;
        ctx.lineCap = 'round';
        ctx.lineWidth = this.depth > 0 ? 1.5 : 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';        
        ctx.shadowColor = 'rgba(255, 255, 255, 1)';
        ctx.shadowBlur = this.depth > 0 ? 10 : 20;

        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.stroke();
        ctx.restore();

        this.branches.forEach(branch => branch.draw(ctx));
    }
}

class Star {
    constructor() {
        this.x = Math.random() * skyCanvas.width;
        this.y = Math.random() * skyCanvas.height;
        this.radius = Math.random() * 1.5;
        this.initialAlpha = Math.random() * 0.5 + 0.5;
        this.alpha = Math.random() * this.initialAlpha;
        this.twinkleSpeed = (Math.random() - 0.5) * 0.015;
    }

    draw(ctx, alphaMultiplier) {
        const currentAlpha = this.alpha * alphaMultiplier;
        if (currentAlpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.alpha += this.twinkleSpeed;
        if (this.alpha > this.initialAlpha || this.alpha < 0.3) {
            this.twinkleSpeed *= -1;
            this.alpha = Math.max(0.3, Math.min(this.alpha, this.initialAlpha));
        }
    }
}

class shootingStar {
    constructor() {
        this.reset();        
    }
    reset() {
        this.x = Math.random() * effectsCanvas.width * 1.5;
        this.y = -20;
        this.len = Math.random() * 80 + 10;
        this.speed = Math.random() * 10 + 6;
        this.active = true;
    }
    update() {
        if (this.active) {
            this.x -= this.speed;
            this.y += this.speed;
            if (this.x < -this.len || this.y > effectsCanvas.height + this.len) {
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

function createClouds(theme) {
    let targetLight = 0;
    let targetHeavy = 0;
    switch (theme) {
        case 'sunny': targetLight = 8; break;
        case 'night': targetLight = 5; break;
        case 'cloudy': targetLight = 20; targetHeavy = 15; break;
        case 'misty': case 'snowy': targetLight = 15; targetHeavy = 20; break;
        case 'rainy': case 'thunderstorm': targetLight = 15; targetHeavy = 25; break;
    }

    const clearThemes = ['sunny', 'night'];
    const needsFadeIn = appState.previousTheme && clearThemes.includes(appState.previousTheme) && !clearThemes.includes(theme);

    let currentLight = clouds.filter(c => !c.isHeavy).length;
    let currentHeavy = clouds.filter(c => c.isHeavy).length;

    for (let i = 0; i < (targetLight - currentLight); i++) {
        const newCloud = new Cloud(Math.random() * skyCanvas.height * 0.4, false, needsFadeIn);
        newCloud.x = -300 - Math.random() * 200;
        clouds.push(newCloud);
    }

    for (let i = 0; i < (targetHeavy - currentHeavy); i++) {
        const newCloud = new Cloud(Math.random() * skyCanvas.height * 0.3, true, needsFadeIn);
        newCloud.x = -300 - Math.random() * 200;
        clouds.push(newCloud);
    }

    let excessLight = currentLight - targetLight;
    let excessHeavy = currentHeavy - targetHeavy;

    for (const cloud of clouds) {
        if (excessLight > 0 && !cloud.isHeavy && !cloud.isFadingOut) {
            cloud.isFadingOut = true;
            excessLight--;
        }
        if (excessHeavy > 0 && cloud.isHeavy && !cloud.isFadingOut) {
            cloud.isFadingOut = true;
            excessHeavy--;
        }
    }

    clouds.sort((a, b) => a.y - b.y);
}

function drawClouds(progress) {
    for (let i = clouds .length - 1; i>= 0; i--) {
        const c = clouds[i];
        c.update();
        c.draw(skyCtx, progress);
        if (c.alpha <= 0) {
            clouds.splice(i, 1);
        }
    }
}

function createStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) stars.push(new Star());
}

function drawStars(progress) {
    const targetAlpha = isNight(appState.theme) ? 1.0 : 0.0;
    const startAlpha = isNight(appState.previousTheme) ? 1.0 : 0.0;
    let alphaMultiplier = lerp(startAlpha, targetAlpha, progress);

    stars.forEach(s => {
        s.update();
        s.draw(skyCtx, alphaMultiplier);
    });
}

function drawShootingStars() {
    if (isNight(appState.theme) && !appState.isTransitioning) {
        if (Math.random() < 0.005 && shootingStars.length < 3) {
            shootingStars.push(new shootingStar());
        }
    }
    shootingStars.forEach((star, index) => {
        star.update();
        star.draw(skyCtx);
        if (!star.active) shootingStars.splice(index, 1);
    });
}

function handleWeatherEffects() {
    const {activeWeatherEffect} = appState;
    if (activeWeatherEffect === 'none' || appState.isTransitioning) return;

    const heavyClouds = clouds.filter(c => c.isHeavy && c.alpha > 0.5);
    if (heavyClouds.length === 0) return;

    if (activeWeatherEffect === 'rainy') {
        if (particles.length < 400 && Math.random() > 0.2) {
            for(let i = 0; i < 3; i++) {
                const cloud = heavyClouds[Math.floor(Math.random() * heavyClouds.length)];
                if (cloud.puffs.length === 0) continue;

                const puff = cloud.puffs[Math.floor(Math.random() * cloud.puffs.length)];
                const x = cloud.x + puff.offsetX + (Math.random() - 0.5) * puff.radius * 0.8;
                const y = cloud.y + puff.offsetY + puff.radius * 0.3;

                particles.push(new RainDrop(x, y, 1.5, Math.random() * 0.4 - 0.2, Math.random() * 5 + 5));
                
            }
        }
    } else if (activeWeatherEffect === 'snowy') {
        if (particles.length < 200 && Math.random() > 0.4) {
            for (let i = 0; i < 2; i++) {
                const cloud = heavyClouds[Math.floor(Math.random() * heavyClouds.length)];
                if (cloud.puffs.length === 0) continue;

                const puff = cloud.puffs[Math.floor(Math.random() * cloud.puffs.length)];
                const x = cloud.x + puff.offsetX + (Math.random() - 0.5) * puff.radius;
                const y = cloud.y + puff.offsetY + puff.radius * 0.3;

                particles.push(new Snowflake(x, y, Math.random() * 2 + 1, Math.random() * 0.5 - 0.25, Math.random() * 1 + 0.5));
            }
        }
    }
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            p.draw(effectsCtx);
        }
    }
}

function drawLightning() {
    if (appState.theme === 'thunderstorm' && Math.random() > 0.998 && lightningBolts.length < 1) {
        const heavyClouds = clouds.filter(c => c.isHeavy);
        if (heavyClouds.length > 0) {
            const cloud = heavyClouds[Math.floor(Math.random() * heavyClouds.length)];
            const bolt = new LightningBolt(cloud.x, cloud.y, Math.PI / 2);
            lightningBolts.push(bolt);
        }
    }
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const bolt = lightningBolts[i];

        bolt.extend();
        bolt.update();

        if (bolt.life <= 0) {
            lightningBolts.splice(i, 1);
        } else {
            bolt.draw(effectsCtx);
        }
    }
}

function drawCardEffects() {
    cardEffectsCtx.clearRect(0, 0, cardEffectsCanvas.width, cardEffectsCanvas.height);
    if (appState.theme === 'snowy' || frostLines.length > 0) {
        drawFrost();
    }
    if (isHeaterActive) {
        drawCardHeat();
    }
}

function drawCardHeat() {
    let heatMultiplier = 1.0;
    if (appState.theme === 'sunny') heatMultiplier = 1.5;
    else if (appState.theme === 'cloudy') heatMultiplier = 1.2;
    
    const cardRect = weatherCard.getBoundingClientRect();
    const isMouseOverCard = mouse.x > cardRect.left && mouse.x < cardRect.right && mouse.y > cardRect.top && mouse.y < cardRect.bottom;

    if (isMouseOverCard) {
        currentHeatPoint.x = mouse.cardX;
        currentHeatPoint.y = mouse.cardY;
        currentHeatPoint.intensity = Math.min(1.0, currentHeatPoint.intensity + (0.04 * heatMultiplier));
        if (heatTrail.length === 0 || Math.hypot(currentHeatPoint.x - heatTrail[heatTrail.length-1].x, currentHeatPoint.y - heatTrail[heatTrail.length-1].y) > 5) {
            heatTrail.push({...currentHeatPoint});
        }
    }

    if (currentHeatPoint.intensity > 0) {
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

class MeltDrip {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = 2.0;
        this.speedY = Math.random() * 0.5 + 0.2;
        this.gravity = 0.02;
    }
    update() {
        this.speedY += this.gravity;
        this.y += this.speedY;
    }
    draw(ctx) {
        const streakLength = this.r * 5;
        const gradient = ctx.createLinearGradient(this.x, this.y - streakLength, this.x, this.y);
        gradient.addColorStop(0, `rgba(210, 220, 235, 0)`);
        gradient.addColorStop(1, `rgba(210, 220, 235, 0.6)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.r * 0.75;
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
        this.autoMeltSpeed = 0;
        this.initialLength = 0;
        this.dripCooldown = 0;
    }
    update(ctx, mouse, heatRadius, isHeaterActive, isThemeSnowy) {
        const lastPoint = this.path[this.path.length - 1];

        let shouldStartMelting = (isHeaterActive && mouse.cardX !== undefined && Math.hypot(lastPoint.x - mouse.cardX, lastPoint.y - mouse.cardY) < heatRadius) || this.autoMeltSpeed > 0;

        if (this.isFrozen && shouldStartMelting) {
            this.isFrozen = false;
            this.meltTimer = 180;
            this.initialLength = this.path.length;
        }

        if (this.dripCooldown > 0) {
            this.dripCooldown--;
        }

        if (!this.isFrozen) {
            if (this.path.length > 1) {
                this.meltTimer--;
                
                const meltAmount = isHeaterActive ? 3 : this.autoMeltSpeed;
                for (let i = 0; i < meltAmount && this.path.length > 1; i++) {
                    this.path.pop();
                }

                if (this.dripCooldown <= 0 && Math.random() < 0.005) {
                 const dripPoint = this.path[this.path.length - 1];
                 const cardRect = weatherCard.getBoundingClientRect();
                 const globalX = cardRect.left + dripPoint.x;
                 const globalY = cardRect.top + dripPoint.y;
                 globalMeltDrips.push(new MeltDrip(globalX, globalY));

                 this.dripCooldown = 30 + Math.random() * 100;
                }

            } else {
                this.life = 0;
            }

        } else if (isThemeSnowy && this.life > 0) {
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
                    frostLines.push(new FrostCrystal(newX, newY, branchAngle, ctx));
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
            angle = Math.random() * Math.PI - Math.PI / 4;
        } else if (side === 1) {
            x = width;
            y = Math.random() * height;
            angle = Math.random() * Math.PI / 2 + Math.PI / 2 + Math.PI / 4;
        } else if (side === 2) {
            x = Math.random() * width;
            y = 0;
            angle = Math.random() * Math.PI / 2 + Math.PI / 4;
        } else {
            x = Math.random() * width;
            y = height;
            angle = Math.random() * Math.PI / 2 - Math.PI - Math.PI / 4;
        }
        frostLines.push(new FrostCrystal(x, y, angle, cardEffectsCtx));
    }
}

function drawFrost() {
    let heatMultiplier = 1.0;
    if (appState.theme === 'sunny') heatMultiplier = 1.5;
    else if (appState.theme === 'cloudy') heatMultiplier = 1.2;
    else if (appState.theme === 'snowy') heatMultiplier = 1.0;

    const heatRadius = 45 * heatMultiplier;
    const isThemeSnowy = appState.theme === 'snowy';

    for (let i = frostLines.length -1; i>= 0; i--) {
        const crystal = frostLines[i];
        crystal.update(cardEffectsCtx, mouse, heatRadius, isHeaterActive, isThemeSnowy);
        crystal.draw(cardEffectsCtx);
        if (crystal.life <= 0 && crystal.path.length <= 1) {
            frostLines.splice(i, 1);
        }
    }

    if (isThemeSnowy && frostLines.length < 400) {
        if (Math.random() < 0.1) {
            const {width, height} = cardEffectsCanvas.getBoundingClientRect();
            let x, y, angle;
            const side = Math.floor(Math.random() * 4);

            if (side === 0) {
                x = 0;
                y = Math.random() * height;
                angle = Math.random() * Math.PI / 2 - Math.PI / 4;
            } else if (side === 1) {
                x = width;
                y = Math.random() * height;
                angle = Math.random() * Math.PI / 2 + Math.PI / 2 + Math.PI / 4;
            } else if (side === 2) {
                x = Math.random() * width;
                y = 0;
                angle = Math.random() * Math.PI / 2 + Math.PI / 4;
            } else {
                x = Math.random() * width;
                y = height;
                angle = Math.random() * Math.PI / 2 - Math.PI - Math.PI / 4;
            }
            frostLines.push(new FrostCrystal(x, y, angle, cardEffectsCtx));
        }
    }
}

function drawMeltDrips() {
    for (let i = globalMeltDrips.length - 1; i >= 0; i--) {
        const drip = globalMeltDrips[i];
        drip.update();
        if (drip.y > effectsCanvas.height) {
            globalMeltDrips.splice(i, 1);
        } else {
            drip.draw(effectsCtx);
        }
    }
}