const bodyEl = document.body;
const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const geoButton = document.getElementById('geo-button');

const loader = document.getElementById('loader');
const cardContent = document.getElementById('card-content');
const locationEl = document.getElementById('location-name');
const tempEl = document.getElementById('temperature');
const descEl = document.getElementById('weather-description');
const feelsLikeEl = document.getElementById('feels-like');
const uvIndexEl = document.getElementById('uv-index');
const hourlyForecastEl = document.getElementById('hourly-forecast');

const clockArcContainer = document.getElementById('clock-arc-container');
const clockDisplay = document.getElementById('clock-display');
const hourHand = document.getElementById('hour-hand');
const minuteHand = document.getElementById('minute-hand');
let isDraggingClock = false;
let clockDragState = { lastMinuteFraction: 0, hourOffset: 0, activeHand: 'minute' };

const THEME_WARMTH = {
    sunny: 3,
    cloudy: 2,
    misty: 1,
    rainy: 1,
    thunderstorm: 1,
    night: 1,
    snowy: 0
};

const SKY_COLOR_STOPS = [
    {time: 0.0,  colors: {top: '#0f1018', bottom: '#242B3E'}},    // Midnight
    {time: 0.20, colors: {top: '#0f1018', bottom: '#242B3E'}},    // End of Night
    {time: 0.22, colors: {top: '#1c2a49', bottom: '#4a5a7b'}},    // Astronomical Twilight
    {time: 0.25, colors: {top: '#4A85D3', bottom: '#73628A'}},    // Nautical Twilight (purple)
    {time: 0.28, colors: {top: '#4A85D3', bottom: '#F79D51'}},    // Civil Twilight (orange)
    {time: 0.42, colors: {top: '#4A85D3', bottom: '#AEC9E8'}},    // Morning
    {time: 0.5,  colors: {top: '#63a4ff', bottom: '#a2c8f0'}},    // Midday
    {time: 0.58, colors: {top: '#4A85D3', bottom: '#AEC9E8'}},    // Afternoon
    {time: 0.68, colors: {top: '#4A85D3', bottom: '#F79D51'}},    // Sunset Start (orange)
    {time: 0.75, colors: {top: '#4A85D3', bottom: '#73628A'}},    // Civil Twilight (purple)
    {time: 0.78, colors: {top: '#1c2a49', bottom: '#4a5a7b'}},    // Nautical Twilight
    {time: 0.81, colors: {top: '#0f1018', bottom: '#242B3E'}},    // Night starts
    {time: 1.0,  colors: {top: '#0f1018', bottom: '#242B3E'}},    // Midnight
];

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
const thunderSound = document.getElementById('thunder-sound');
const allSounds = [rainSound, thunderSound];

// Icon
const icons = new Skycons({"color" : "white"});
icons.play();

// Time
const now = new Date();
const initialTimeOfDay = (now.getHours() * 60 + now.getMinutes()) / 1440;

let appState = {
    theme: '',
    previousTheme: '',
    isTimeTransitioning: false,
    timeTransitionStartTime: 0,
    timeTransitionDuration: 5000,
    isThemeTransitioning: false,
    themeTransitionStartTime: 0,
    themeTransitionDuration: 3000,
    themeTransitionProgress: 1,
    
    startTimeOfDay: initialTimeOfDay,
    timeOfDay: initialTimeOfDay,
    targetTimeOfDay: initialTimeOfDay,
    
    sun: {x: 0, y: 0, size: 50},
    moon: {x: 0, y: 0, size: 40},
    
    isFlameBurntScheduled: false,
    activeWeatherEffect: 'none',
    isThemeLocked: false,
};

let particles = [];
let fireParticles = [];
let smokeParticles = [];
let sootParticles = [];

let stars = [];
let shootingStars = [];
let clouds = [];
let lightningBolts = [];

let frostLines = [];
let isMouseBurnt = false;
let heaterStartTime = 0;
let flameDouseCounter = 0;

let lastSootTime = 0;
let lastSmokeTime = 0;
let lastSnowflakeTime = 0;

let userHasInteracted = false;
let isUmbrellaActive = false;
let isHeaterActive = false;
let isTorchActive = false;
let isBucketActive = false;
let moonTextureCanvas;

const mouse = {x: undefined, y: undefined, radius: 300};
const mouseShake = {
    lastX: 0, lastY: 0, lastTime: 0, speed: 0, SHAKE_THRESHOLD: 1.8
};

const HEATER_MELT_RADIUS = 100;
const HEATER_SMOKE_INTERVAL = 100;
const MOUSE_PARTICLE_RADIUS = 50;
const MOUSE_PARTICLE_STRENGTH = 2;
const SNOWFLAKE_MELT_DELAY_FRAMES = 30;
const SOOT_PRODUCTION_INTERVAL = 150;
const SOOT_DELAY = 1500;
const RAIN_HITS_TO_EXTINGUISH = 15;
const SNOWFLAKE_INTERVAL = 50;

window.addEventListener('DOMContentLoaded', () => {
    moonTextureCanvas = createMoonTexture(128);
    setupCanvases();
    addEventListeners();
    const isInitiallyNight = initialTimeOfDay < 0.28 || initialTimeOfDay > 0.72;
    const initialTheme = isInitiallyNight ? 'night' : 'sunny';
    setTheme(initialTheme, true, null, false);
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
            setTheme(button.dataset.theme, false, null, true);
        }
    });
    clockArcContainer.addEventListener('mousedown', (e) => {
        isDraggingClock = true;
        appState.isTimeTransitioning = false;

        const time = appState.timeOfDay % 1.0;
        const totalMinutes = time * 1440;
        const hours = totalMinutes / 60;
        const minutes = totalMinutes % 60;

        clockDragState.lastMinuteFraction = minutes / 60;
        clockDragState.hourOffset = Math.floor(hours);

        updateClockFromEvent(e);
    });
    window.addEventListener('mousemove', (e) => {
        if (isDraggingClock) {
            updateClockFromEvent(e);
        }
    });
    window.addEventListener('mouseup', () => {
        isDraggingClock = false;
    });
}

function setTimeOfDay(newTime, transitionDuration = 5000) {
    let currentTime = appState.timeOfDay % 1.0;
    if (currentTime < 0) currentTime += 1.0;

    const threeHours = 3 / 24.0;
    if (newTime < currentTime) {
        const backwardDistance = currentTime - newTime;
        if (backwardDistance > threeHours) {
            newTime += 1.0;
        }
    }
    else {
        const forwardDistance = newTime - currentTime;
        if (forwardDistance > 1.0 - threeHours) {
            currentTime += 1.0;
        }
    }
    
    appState.targetTimeOfDay = newTime;
    appState.startTimeOfDay = currentTime;
    appState.isTimeTransitioning = true;
    appState.timeTransitionStartTime = performance.now();
    appState.timeTransitionDuration = transitionDuration;
}

function updateClockFromEvent(e) {
    const rect = clockArcContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) + Math.PI / 2;
    if (angle < 0) { angle += 2 * Math.PI; }

    const minuteFraction = angle / (2 * Math.PI);
    
    if (clockDragState.lastMinuteFraction > 0.9 && minuteFraction < 0.1) {
        clockDragState.hourOffset++;
    } else if (clockDragState.lastMinuteFraction < 0.1 && minuteFraction > 0.9) {
        clockDragState.hourOffset--;
    }
    clockDragState.lastMinuteFraction = minuteFraction;
    
    const newMinuteOfHour = minuteFraction * 60;

   const newTotalMinutes = (clockDragState.hourOffset * 60) + newMinuteOfHour;

   let newTimeOfDay = newTotalMinutes / 1440;

   newTimeOfDay = newTimeOfDay % 1.0;
   if (newTimeOfDay < 0) {
    newTimeOfDay += 1.0;
   }

    appState.timeOfDay = newTimeOfDay;
    appState.targetTimeOfDay = newTimeOfDay;
}

function updateClockVisuals() {
    const time = appState.timeOfDay % 1.0;
    const totalMinutes = Math.floor(time * 1440);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    if (clockDisplay.textContent !== formattedTime) {
        clockDisplay.textContent = formattedTime;
    }

    const minuteAngle = (minutes / 60) * 360;
    const hourAngle = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;

    if (hourHand && minuteHand) {
        hourHand.style.transform = `rotate(${hourAngle}deg)`;
        minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
    }
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
    mouse.cardX = e.clientX - cardRect.left;
    mouse.cardY = e.clientY - cardRect.top;
}

async function fetchCoordsByCity(city) {
    showLoader();
    try {
        const response = await fetch(`/api/weather?type=geo&city=${city}`);
        if (!response.ok) throw new Error('City not found.');
        const data = await response.json();
        if (data.length === 0) throw new Error(`Could not find city: ${city}`);
        await fetchWeatherByCoords(data[0].lat, data[0].lon);
    }
    catch (error) { handleError(error.message); }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(`/api/weather?type=weather&lat=${lat}&lon=${lon}`);
        if (!response.ok) throw new Error('Could not fetch weather data.');
        const data = await response.json();
        const cityName = await fetchCityName(lat, lon);
        updateUI(data, cityName);
    }
    catch (error) { handleError(error.message); }   
}

async function fetchCityName(lat, lon) {
    try {
        const response = await fetch(`/api/weather?type=reverseGeo&lat=${lat}&lon=${lon}`);
        if (!response.ok) return 'Current Location';
        const data = await response.json();
        return data.length > 0 ? data[0].name : 'Current Location';
    }
    catch(error) { return 'Current Location'; }
}

function handleSearch() {
    markUserInteraction();
    const city = cityInput.value.trim();
    if (city) fetchCoordsByCity(city);
    else handleError('Please enter a city name.');
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

function showLoader() {
    cardContent.classList.add('loading');
    loader.style.display = 'block';
}

function hideLoader() {
    cardContent.classList.remove('loading');
    loader.style.display = 'none';
}

function markUserInteraction() {
    if (!userHasInteracted) userHasInteracted = true;
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
        hourDiv.innerHTML = `<p>${time}:00</p><canvas id="${iconID}" width="50" height="50"></canvas><p class="temp">${Math.round(hour.temp)}°C</p>`;
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

function setTheme(theme, instant = false, dt = null, isManualOverride = false) {
    if (dt && !isManualOverride) {
        const date = dt;
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const targetTime = (hours * 60 + minutes) / (24 * 60);
        setTimeOfDay(targetTime, 5000);
    } else if (isManualOverride && (theme === 'sunny' || theme === 'night')) {
        const targetTime = (theme === 'sunny') ? 0.5 : 0.0;
        if (instant) {
            appState.timeOfDay = targetTime;
            appState.targetTimeOfDay = targetTime;
            appState.isTimeTransitioning = false;
        } else {
            setTimeOfDay(targetTime, 5000);
        }
    }

    if (!isManualOverride && appState.theme === theme) {
        return;
    }

    if (isManualOverride) {
        appState.isThemeLocked = true;
    } else {
        appState.isThemeLocked = false;
    }
    
    if (isHeaterActive && appState.previousTheme) {
        const oldWarmth = THEME_WARMTH[appState.previousTheme] ?? 0;
        const newWarmth = THEME_WARMTH[appState.theme] ?? 0;
        if (newWarmth > oldWarmth) {
           appState.isFlameBurntScheduled = true;
        }
    }
    
    if (appState.theme && appState.theme !== theme && !instant) {
        appState.isThemeTransitioning = true;
        appState.themeTransitionStartTime = performance.now();
        appState.themeTransitionProgress = 0;
    }

    appState.previousTheme = appState.theme || theme;
    appState.theme = theme;
    
    finaliseThemeChange();
    
    if (appState.previousTheme === 'snowy' && appState.theme !== 'snowy') {
        const meltSpeed = THEME_WARMTH[appState.theme] || 1;
        frostLines.forEach(line => line.autoMeltSpeed = meltSpeed);       
    } else if (appState.theme === 'snowy' && appState.previousTheme !== 'snowy') {
        frostLines = [];
        createFrost();
    }

    createClouds(appState.theme);
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

    if (appState.isFlameBurntScheduled) {
        createFlameBurst();
        appState.isFlameBurntScheduled = false;
    }
}

function isNight() {
    const time = appState.timeOfDay % 1.0;
    return time < 0.28 || time > 0.72;
}

function updateDynamicThemeState() {
    const isCurrentlyNight = isNight();

    if (!appState.isThemeLocked) {
        if (appState.theme === 'sunny' && isCurrentlyNight) {
            setTheme('night', true, null, true);
        } else if (appState.theme === 'night' && !isCurrentlyNight) {
            setTheme('sunny', true, null, true);
        }
    }

    if (isCurrentlyNight && stars.length === 0) {
        createStars(window.innerWidth / 8);
    }
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
    if (tool === 'heater') {
        isHeaterActive = !isHeaterActive;
        if (isHeaterActive) {
            heaterStartTime = performance.now();
            for (let i = 0; i < 30; i++) smokeParticles.push(new SmokeParticle(mouse.x, mouse.y));
        } else {
            heaterStartTime = 0;
            flameDouseCounter = 0;
        }
    }
    if (tool === 'torch') isTorchActive = !isTorchActive;  
    
    updateToolsVisibility();
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
    
    updateDynamicThemeState();
    updateClockVisuals();

    if (appState.isTimeTransitioning) {
        const elapsed = timestamp - appState.timeTransitionStartTime;
        const progress = Math.min(elapsed / appState.timeTransitionDuration, 1.0);
        appState.timeOfDay = lerp(appState.startTimeOfDay, appState.targetTimeOfDay, progress);
        
        if (progress >= 1.0) {
            appState.isTimeTransitioning = false;
            appState.timeOfDay = appState.targetTimeOfDay % 1.0;
            if (appState.timeOfDay < 0) appState.timeOfDay += 1.0;
        }
    }
    
    if (appState.isThemeTransitioning) {
        const elapsed = timestamp - appState.themeTransitionStartTime;
        appState.themeTransitionProgress = Math.min(elapsed / appState.themeTransitionDuration, 1.0);
        if (appState.themeTransitionProgress >= 1.0) {
            appState.isThemeTransitioning = false;
            appState.previousTheme = appState.theme;
        }
    }
    drawDynamicSky();
    drawStars();
    drawShootingStars();
    drawCelestialBodies();
    drawClouds();

    drawParticles();

    handleWeatherEffects(timestamp);
    drawLightning();
    drawUmbrellaShade(effectsCtx);
    drawCardEffects();

    handleFireEffect(timestamp);
    handleBurntMouseLogic(timestamp);
    handleRainExtinguishLogic();
    drawFireAndSmoke(effectsCtx);
    drawSoot(effectsCtx);

    requestAnimationFrame(animate);
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

function lerpColor(c1, c2, amt) {
    const [r1, g1, b1] = c1.match(/\w\w/g).map(h => parseInt(h, 16));
    const [r2, g2, b2] = c2.match(/\w\w/g).map(h => parseInt(h, 16));
    const r = Math.round(lerp(r1, r2, amt));
    const g = Math.round(lerp(g1, g2, amt));
    const b = Math.round(lerp(b1, b2, amt));
    const toHex = (c) => ('0' + c.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function drawDynamicSky() {
    const currentSkyColors = getSkyColorsForTime(appState.timeOfDay % 1.0);
    const gradient = skyCtx.createLinearGradient(0, 0, 0, skyCanvas.height);
    gradient.addColorStop(0, currentSkyColors.top);
    gradient.addColorStop(1, currentSkyColors.bottom);
    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
}

function drawCelestialBodies() {
    skyCtx.save();
    const time = appState.timeOfDay;
    const angle = time * Math.PI * 2 + (Math.PI / 2);
    const centerX = skyCanvas.width / 2;
    const centerY = skyCanvas.height * 1.2;
    const radiusX = skyCanvas.width / 2 + 100;
    const radiusY = skyCanvas.height * 1.1;
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
    for (let i = 0; i < 50; i++) {
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
    if (!isUmbrellaActive || isNight() || mouse.x === undefined || appState.sun.y > skyCanvas.height) {
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

function handleFireEffect(timestamp) {
    if (!isHeaterActive || mouse.x === undefined) return;
    
    for (let i = 0; i < 3; i++) {
        fireParticles.push(new FireParticle(mouse.x, mouse.y));
    }

    if (timestamp - lastSmokeTime > HEATER_SMOKE_INTERVAL) {
        const smokeY = mouse.y - 15;
        const smokeX = mouse.x + (Math.random() - 0.5) * 10;

        smokeParticles.push(new SmokeParticle(smokeX, smokeY));
        lastSmokeTime = timestamp;
    }
}

function drawFireAndSmoke(ctx) {
    for (let i = fireParticles.length - 1; i >= 0; i--) {
        const p = fireParticles[i];
        p.update();
        if (p.life <= 0) {
            fireParticles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.update();
        if (p.life <= 0) {
            smokeParticles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
}

function getCloudColorForTime(theme, isHeavy, time) {
    const colors = {
        normal_day:   isHeavy ? [200, 205, 210] : [255, 255, 255],
        normal_night: isHeavy ? [45, 50, 60]    : [65, 70, 80],
        rain_day:     isHeavy ? [90, 100, 110]  : [120, 125, 130],
        rain_night:   isHeavy ? [80, 90, 100]   : [110, 115, 120],
        thunder_day:  isHeavy ? [60, 65, 75]    : [80, 85, 95],
        thunder_night:isHeavy ? [50, 55, 65]    : [70, 75, 85],
        snow_day:     isHeavy ? [190, 195, 200] : [230, 235, 240],
        snow_night:   isHeavy ? [180, 185, 190] : [220, 225, 230],
    };

    let day_colors, night_colors;
    switch (theme) {
        case 'rainy': day_colors = colors.rain_day; night_colors = colors.rain_night; break;
        case 'thunderstorm': day_colors = colors.thunder_day; night_colors = colors.thunder_night; break;
        case 'snowy': day_colors = colors.snow_day; night_colors = colors.snow_night; break;
        default: day_colors = colors.normal_day; night_colors = colors.normal_night; break;
    }
    
    const day_opacity = isHeavy ? 0.85 : 0.7;
    const night_opacity = isHeavy ? 0.8 : 0.65;
    
    const dawn_start = 0.25, dawn_end = 0.40;
    const dusk_start = 0.65, dusk_end = 0.80;
    let daylight = 0.0;

    if (time >= dawn_end && time <= dusk_start) {
        daylight = 1.0;
    } else if (time > dawn_start && time < dawn_end) {
        daylight = (time - dawn_start) / (dawn_end - dawn_start);
    } else if (time > dusk_start && time < dusk_end) {
        daylight = 1.0 - ((time - dusk_start) / (dusk_end - dusk_start));
    }
    
    const r = lerp(night_colors[0], day_colors[0], daylight);
    const g = lerp(night_colors[1], day_colors[1], daylight);
    const b = lerp(night_colors[2], day_colors[2], daylight);
    const final_opacity = lerp(night_opacity, day_opacity, daylight);

    let opacity_override = null;
    if (theme === 'rainy') opacity_override = isHeavy ? 0.9 : 0.75;
    if (theme === 'thunderstorm') opacity_override = isHeavy ? 0.95 : 0.8;
    if (theme === 'snowy') opacity_override = 0.85;

    return { rgb: [r, g, b], opacity: opacity_override !== null ? opacity_override : final_opacity };
}

function getCloudColorSet(isHeavy) {
    const time = appState.timeOfDay % 1.0;
    const targetSet = getCloudColorForTime(appState.theme, isHeavy, time);

    if (appState.isThemeTransitioning && appState.themeTransitionProgress < 1.0) {
        const sourceSet = getCloudColorForTime(appState.previousTheme, isHeavy, time);
        const progress = appState.themeTransitionProgress;
        
        const r = Math.round(lerp(sourceSet.rgb[0], targetSet.rgb[0], progress));
        const g = Math.round(lerp(sourceSet.rgb[1], targetSet.rgb[1], progress));
        const b = Math.round(lerp(sourceSet.rgb[2], targetSet.rgb[2], progress));
        const opacity = lerp(sourceSet.opacity, targetSet.opacity, progress);

        return { color: `${r}, ${g}, ${b}`, opacity: opacity };
    }

    const { rgb, opacity } = targetSet;
    return { color: `${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}`, opacity };
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
    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        const currentSet = getCloudColorSet(this.isHeavy);
        const baseColor = currentSet.color;
        const baseOpacity = currentSet.opacity;
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
        if (mouse.x !== undefined) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distance = Math.hypot(dx, dy);
            if (distance < MOUSE_PARTICLE_RADIUS) {
                const force = (MOUSE_PARTICLE_RADIUS - distance) / MOUSE_PARTICLE_RADIUS;
                const interactionStrength = MOUSE_PARTICLE_STRENGTH * (this.mouseInteractionMultiplier ?? 1);
                this.x += (dx / distance) * force * interactionStrength;
                this.y += (dy / distance) * force * interactionStrength;
            }
        }
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
    constructor(x, y, size, speedX, speedY) {
        super(x, y, size, speedX, speedY);
        this.heatExposure = 0;
    }
    update() {
        super.update();
        if (this.life <= 0) return;

        let isInHeat = false;
        if (isHeaterActive && mouse.x !== undefined) {
            const distanceToHeater = Math.hypot(this.x - mouse.x, this.y - mouse.y);
            if (distanceToHeater < HEATER_MELT_RADIUS) {
                isInHeat = true;
                this.heatExposure++;
            }
        }
        if (!isInHeat) {
            this.heatExposure = Math.max(0, this.heatExposure - 1);
        }
        if (this.heatExposure > SNOWFLAKE_MELT_DELAY_FRAMES) {
            particles.push(new MeltDrip(this.x, this.y));
            this.life = 0;
            return;
        }
        const isWarmerTheme = THEME_WARMTH[appState.theme] > THEME_WARMTH.snowy;
        if (isWarmerTheme) {
            const meltChance = (THEME_WARMTH[appState.theme] / 3) * 0.005;
            if (Math.random() < meltChance) {
                particles.push(new MeltDrip(this.x, this.y));
                this.life = 0;
                return;
            }
        }
    }
    draw(ctx) {
        if (this.life <= 0) return;
        const currentSize = this.size * (1 - this.heatExposure / SNOWFLAKE_MELT_DELAY_FRAMES);
        if (currentSize < 0.5) return;
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
            this.branches.push(new LightningBolt(newX, newY, branchAngle, this.depth + 1));
        }
    }
    update() { this.life -= 0.02; }
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
        for (let i = 1; i < this.path.length; i++) ctx.lineTo(this.path[i].x, this.path[i].y);
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
    constructor() { this.reset(); }
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

class SootParticle {
    constructor(mouseX, mouseY) {
        this.offsetX = (Math.random() - 0.5) * 20;
        this.offsetY = (Math.random() - 0.5) * 20;
        this.x = mouseX + this.offsetX;
        this.y = mouseY + this.offsetY;
        this.size = Math.random() * 4 + 2;
        this.isStuck = true;
        this.gravity = 0;
    }
    update(mouseX, mouseY) {
        if (this.isStuck) {
            this.x = mouseX + this.offsetX;
            this.y = mouseY + this.offsetY;
        } else {
            if (isUmbrellaActive && mouse.x !== undefined) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.hypot(dx, dy);
                if (distance < 150) {
                    const force = (150 - distance) / 150;
                    this.x -= (dx / distance) * force * 10;
                }
            }
            this.gravity += 0.1;
            this.y += this.gravity;
        }
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(20, 10, 0, 0.8)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function getSkyColorsForTime(time) {
    let prevStop = SKY_COLOR_STOPS[0];
    let nextStop = SKY_COLOR_STOPS[SKY_COLOR_STOPS.length - 1];
    for (let i = 1; i < SKY_COLOR_STOPS.length; i++) {
        if (SKY_COLOR_STOPS[i].time >= time) {
            nextStop = SKY_COLOR_STOPS[i];
            prevStop = SKY_COLOR_STOPS[i - 1];
            break;
        }
    }
    const stopDuration = nextStop.time - prevStop.time;
    let progress = stopDuration === 0 ? 0 : (time - prevStop.time) / stopDuration;
    return {
        top: lerpColor(prevStop.colors.top, nextStop.colors.top, progress),
        bottom: lerpColor(prevStop.colors.bottom, nextStop.colors.bottom, progress)
    };
}

function createClouds(theme) {
    let targetLight = 0, targetHeavy = 0;
    switch (theme) {
        case 'sunny': targetLight = 8; break;
        case 'night': targetLight = 5; break;
        case 'cloudy': targetLight = 20; targetHeavy = 15; break;
        case 'misty': case 'snowy': targetLight = 15; targetHeavy = 20; break;
        case 'rainy': case 'thunderstorm': targetLight = 15; targetHeavy = 25; break;
    }
    const needsFadeIn = !!appState.previousTheme;
    let currentLight = clouds.filter(c => !c.isHeavy).length;
    let currentHeavy = clouds.filter(c => c.isHeavy).length;
    for (let i = 0; i < (targetLight - currentLight); i++) clouds.push(new Cloud(Math.random() * skyCanvas.height * 0.4, false, needsFadeIn));
    for (let i = 0; i < (targetHeavy - currentHeavy); i++) clouds.push(new Cloud(Math.random() * skyCanvas.height * 0.3, true, needsFadeIn));
    let excessLight = currentLight - targetLight;
    let excessHeavy = currentHeavy - targetHeavy;
    for (const cloud of clouds) {
        if (excessLight > 0 && !cloud.isHeavy && !cloud.isFadingOut) { cloud.isFadingOut = true; excessLight--; }
        if (excessHeavy > 0 && cloud.isHeavy && !cloud.isFadingOut) { cloud.isFadingOut = true; excessHeavy--; }
    }
    clouds.sort((a, b) => a.y - b.y);
}

function drawClouds() {
    for (let i = clouds.length - 1; i>= 0; i--) {
        const c = clouds[i];
        c.update();
        c.draw(skyCtx);
        if (c.alpha <= 0) clouds.splice(i, 1);
    }
}

function createStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) stars.push(new Star());
}

function drawStars() {
    let alphaMultiplier = isNight() ? 1.0 : 0.0;
    if (appState.isTimeTransitioning) {
        const startIsNight = (appState.startTimeOfDay % 1.0) < 0.29 || (appState.startTimeOfDay % 1.0) > 0.71;
        const startAlpha = startIsNight ? 1.0 : 0.0;
        const elapsed = performance.now() - appState.timeTransitionStartTime;
        const progress = Math.min(elapsed / appState.timeTransitionDuration, 1.0);
        alphaMultiplier = lerp(startAlpha, alphaMultiplier, progress);
    }
    stars.forEach(s => {
        s.update();
        s.draw(skyCtx, alphaMultiplier);
    });
}

function drawShootingStars() {
    if (isNight() && !appState.isTimeTransitioning && Math.random() < 0.005 && shootingStars.length < 3) {
        shootingStars.push(new shootingStar());
    }
    shootingStars.forEach((star, index) => {
        star.update();
        star.draw(skyCtx);
        if (!star.active) shootingStars.splice(index, 1);
    });
}

function handleWeatherEffects(timestamp) {
    const {activeWeatherEffect} = appState;
    if (activeWeatherEffect === 'none' || appState.isTimeTransitioning) return;
    const heavyClouds = clouds.filter(c => c.isHeavy && c.alpha > 0.5);
    if (heavyClouds.length === 0) return;
    if (activeWeatherEffect === 'rainy' && particles.length < 400 && Math.random() > 0.2) {
        for(let i = 0; i < 3; i++) {
            const cloud = heavyClouds[Math.floor(Math.random() * heavyClouds.length)];
            if (cloud.puffs.length === 0) continue;
            const puff = cloud.puffs[Math.floor(Math.random() * cloud.puffs.length)];
            const x = cloud.x + puff.offsetX + (Math.random() - 0.5) * puff.radius * 0.8;
            const y = cloud.y + puff.offsetY + puff.radius * 0.3;
            particles.push(new RainDrop(x, y, 1.5, Math.random() * 0.4 - 0.2, Math.random() * 5 + 5));
        }
    } else if (activeWeatherEffect === 'snowy' && particles.length < 200 && (timestamp - lastSnowflakeTime > SNOWFLAKE_INTERVAL)) {
        lastSnowflakeTime = timestamp;
        const cloud = heavyClouds[Math.floor(Math.random() * heavyClouds.length)];
        if (cloud.puffs.length === 0) return;
        const puff = cloud.puffs[Math.floor(Math.random() * cloud.puffs.length)];
        const x = cloud.x + puff.offsetX + (Math.random() - 0.5) * puff.radius;
        const y = cloud.y + puff.offsetY + puff.radius * 0.3;
        particles.push(new Snowflake(x, y, Math.random() * 2 + 1, Math.random() * 0.5 - 0.25, Math.random() * 1 + 0.5));
    }
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) particles.splice(i, 1);
        else p.draw(effectsCtx);
    }
}

function drawLightning() {
    if (appState.theme === 'thunderstorm' && Math.random() > 0.998 && lightningBolts.length < 1) {
        const heavyClouds = clouds.filter(c => c.isHeavy);
        if (heavyClouds.length > 0) {
            const cloud = heavyClouds[Math.floor(Math.random() * heavyClouds.length)];
            lightningBolts.push(new LightningBolt(cloud.x, cloud.y, Math.PI / 2));
        }
    }
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const bolt = lightningBolts[i];
        bolt.extend();
        bolt.update();
        if (bolt.life <= 0) lightningBolts.splice(i, 1);
        else bolt.draw(effectsCtx);
    }
}

function drawCardEffects() {
    const cardRect = weatherCard.getBoundingClientRect();
    if(cardEffectsCanvas.width !== cardRect.width * dpr || cardEffectsCanvas.height !== cardRect.height * dpr) {
        const setCanvasSize = (canvas, ctx) => {
            canvas.width = cardRect.width * dpr;
            canvas.height = cardRect.height * dpr;
            ctx.scale(dpr, dpr);
        };
        setCanvasSize(cardEffectsCanvas, cardEffectsCtx);
    }
    cardEffectsCtx.clearRect(0, 0, cardEffectsCanvas.width, cardEffectsCanvas.height);
    if (appState.theme === 'snowy' || frostLines.length > 0) drawFrost();
    if (isHeaterActive) drawCardHeat();
}

function drawCardHeat() {
    const cardRect = weatherCard.getBoundingClientRect();
    const isMouseOverCard = mouse.x > cardRect.left && mouse.x < cardRect.right && mouse.y > cardRect.top && mouse.y < cardRect.bottom;
    let cardHeatPoint = { x: 0, y: 0, intensity: 0, lastMouseX: 0, lastMouseY: 0 };
    if (isHeaterActive && isMouseOverCard) {
        const distanceMoved = Math.hypot(mouse.cardX - cardHeatPoint.lastMouseX, mouse.cardY - cardHeatPoint.lastMouseY);
        if (distanceMoved < 2) {
            cardHeatPoint.intensity = Math.min(1.0, cardHeatPoint.intensity + 0.005);
            if (cardHeatPoint.intensity < 0.05) {
                cardHeatPoint.x = mouse.cardX;
                cardHeatPoint.y = mouse.cardY;
            }
        } else {
            cardHeatPoint.intensity = Math.max(0, cardHeatPoint.intensity - 0.01);
        }
        cardHeatPoint.lastMouseX = mouse.cardX;
        cardHeatPoint.lastMouseY = mouse.cardY;
    } else {
        cardHeatPoint.intensity = Math.max(0, cardHeatPoint.intensity - 0.01);
    }
    if (cardHeatPoint.intensity > 0.01) {
        const glowRadius = 20 + (60 * cardHeatPoint.intensity);
        cardEffectsCtx.save();
        cardEffectsCtx.shadowColor = `rgba(255, 100, 0, ${0.8 * cardHeatPoint.intensity})`;
        cardEffectsCtx.shadowBlur = 10 + 30 * cardHeatPoint.intensity;
        const gradient = cardEffectsCtx.createRadialGradient(cardHeatPoint.x, cardHeatPoint.y, 0, cardHeatPoint.x, cardHeatPoint.y, glowRadius);
        gradient.addColorStop(0, `rgba(255, 80, 0, ${0.7 * cardHeatPoint.intensity})`);
        gradient.addColorStop((30 * cardHeatPoint.intensity) / glowRadius, `rgba(200, 40, 0, ${0.5 * cardHeatPoint.intensity})`);
        gradient.addColorStop(1, 'rgba(150, 0, 0, 0)');
        cardEffectsCtx.fillStyle = gradient;
        cardEffectsCtx.beginPath();
        cardEffectsCtx.arc(cardHeatPoint.x, cardHeatPoint.y, glowRadius, 0, Math.PI * 2);
        cardEffectsCtx.fill();
        cardEffectsCtx.restore();
    }
}

function handleBurntMouseLogic(timestamp) {
    if (isHeaterActive && !isMouseBurnt && heaterStartTime > 0 && timestamp - heaterStartTime > SOOT_DELAY) {
        if (timestamp - lastSootTime > SOOT_PRODUCTION_INTERVAL && Math.random() > 0.6) {
            if (sootParticles.length < 80) sootParticles.push(new SootParticle(mouse.x, mouse.y));
            else isMouseBurnt = true;
            lastSootTime = timestamp;
        }
    }
    if (sootParticles.length > 0) {
        let wasCleaned = false;
        if (appState.theme === 'rainy' || appState.theme === 'thunderstorm') {
            let rainHits = 0;
            for (const p of particles) {
                if (p instanceof RainDrop && Math.hypot(p.x - mouse.x, p.y - mouse.y) < 30) {
                    rainHits++;
                    if (rainHits >= 3) { wasCleaned = true; break; }
                }
            }
        }
        const timeDelta = timestamp - mouseShake.lastTime;
        if (!wasCleaned && timeDelta > 50) {
            const distance = Math.hypot(mouse.x - mouseShake.lastX, mouse.y - mouseShake.lastY);
            mouseShake.speed = distance / timeDelta;
            if (mouseShake.speed > mouseShake.SHAKE_THRESHOLD) wasCleaned = true;
            mouseShake.lastX = mouse.x;
            mouseShake.lastY = mouse.y;
            mouseShake.lastTime = timestamp;
        }
        if (wasCleaned) {
            sootParticles.forEach(p => p.isStuck = false);
            if (isMouseBurnt) isMouseBurnt = false;
        }
    }
}

function handleRainExtinguishLogic() {
    if (!isHeaterActive) { flameDouseCounter = 0; return; }
    flameDouseCounter = Math.max(0, flameDouseCounter - (0.05 + ((THEME_WARMTH[appState.theme] ?? 1) * 0.1)));
    if (appState.theme !== 'rainy' && appState.theme !== 'thunderstorm') return;

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const distanceToFlame = Math.hypot(p.x - mouse.x, p.y - mouse.y);

        if (distanceToFlame < 30) {
            if (p instanceof RainDrop) {
                flameDouseCounter += 2;
                smokeParticles.push(new SmokeParticle(p.x, p.y));
                particles.splice(i, 1);
            }
            else if (p instanceof MeltDrip) {
                smokeParticles.push(new SteamParticle(p.x, p.y));
                particles.splice(i, 1);
            }
        }
    }

    if (flameDouseCounter >= RAIN_HITS_TO_EXTINGUISH) {
        for (let i = 0; i < 25; i++) smokeParticles.push(new SteamParticle(mouse.x, mouse.y));
        toggleTool('heater');
    }
}

function drawSoot(ctx) {
    for (let i = sootParticles.length - 1; i >= 0; i--) {
        const p = sootParticles[i];
        p.update(mouse.x, mouse.y);
        if (p.y > effectsCanvas.height + p.size) sootParticles.splice(i, 1);
        else p.draw(ctx);
    }
}

function createFlameBurst() {
    if (!isHeaterActive || mouse.x === undefined) return;
    for (let i = 0; i < 80; i++) {
        let p = new FireParticle(mouse.x, mouse.y);
        p.speedY = Math.random() * 5 + 4;
        p.size = Math.random() * 30 + 20;
        p.life = 1;
        p.decay = Math.random() * 0.05 + 0.04;
        fireParticles.push(p);
    }
}

class MeltDrip extends Particle {
    constructor(x, y) {
        super(x, y, 2.0, 0, Math.random() * 0.5 + 0.2);
        this.gravity = 0.02;
        this.mouseInteractionMultiplier = 0.3;
    }

    update() {
        this.speedY += this.gravity;
        super.update(); 
    }

    draw(ctx) {
        const streakLength = this.size * 5;
        const gradient = ctx.createLinearGradient(this.x, this.y - streakLength, this.x, this.y);
        gradient.addColorStop(0, `rgba(210, 220, 235, 0)`);
        gradient.addColorStop(1, `rgba(210, 220, 235, 0.6)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.size * 0.75;
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
        this.dripCooldown = 0;
    }
    update(ctx, mouse, heatRadius, isHeaterActive, isThemeSnowy) {
        const lastPoint = this.path[this.path.length - 1];
        let shouldStartMelting = (isHeaterActive && mouse.cardX !== undefined && Math.hypot(lastPoint.x - mouse.cardX, lastPoint.y - mouse.cardY) < heatRadius) || this.autoMeltSpeed > 0;
        if (this.isFrozen && shouldStartMelting) {
            this.isFrozen = false;
        }
        if (this.dripCooldown > 0) this.dripCooldown--;
        if (!this.isFrozen) {
            if (this.path.length > 1) {
                const meltAmount = isHeaterActive ? 3 : this.autoMeltSpeed;
                for (let i = 0; i < meltAmount && this.path.length > 1; i++) this.path.pop();
                if (this.dripCooldown <= 0 && Math.random() < 0.005) {
                 const dripPoint = this.path[this.path.length - 1];
                 const cardRect = weatherCard.getBoundingClientRect();
                 particles.push(new MeltDrip(cardRect.left + dripPoint.x, cardRect.top + dripPoint.y));
                 this.dripCooldown = 30 + Math.random() * 100;
                }
            } else this.life = 0;
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
        for (let i = 1; i < this.path.length; i++) ctx.lineTo(this.path[i].x, this.path[i].y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }
}

class FireParticle {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.size = Math.random() * 20 + 10;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 + 1;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
    }
    update() {
        this.life -= this.decay;
        this.x += this.speedX;
        this.y -= this.speedY;
        this.size *= 0.95;
    }
    draw(ctx) {
        if (this.life <= 0 || this.size < 1) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, `rgba(255, 255, 220, ${this.life * 0.8})`);
        gradient.addColorStop(0.4, `rgba(255, 180, 0, ${this.life * 0.6})`);
        gradient.addColorStop(1, `rgba(210, 50, 0, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class SmokeParticle {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.size = Math.random() * 10 + 5;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 0.5 + 0.5;
        this.life = 1.0;
        this.decay = Math.random() * 0.01 + 0.005;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.01;
    }
    update() {
        this.life -= this.decay;
        this.x += this.speedX;
        this.y -= this.speedY;
        this.size += 0.1;
        this.rotation += this.rotationSpeed;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life * 0.4;
        ctx.fillStyle = '#555';
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class SteamParticle extends SmokeParticle {
    constructor(x, y) {
        super(x, y);
        this.speedY = Math.random() * 1.5 + 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life * 0.6;
        ctx.fillStyle = '#bbbbbb';
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
        if (side === 0) { x = 0; y = Math.random() * height; angle = Math.random() * Math.PI - Math.PI / 4; }
        else if (side === 1) { x = width; y = Math.random() * height; angle = Math.random() * Math.PI / 2 + Math.PI / 2 + Math.PI / 4; }
        else if (side === 2) { x = Math.random() * width; y = 0; angle = Math.random() * Math.PI / 2 + Math.PI / 4; }
        else { x = Math.random() * width; y = height; angle = Math.random() * Math.PI / 2 - Math.PI - Math.PI / 4; }
        frostLines.push(new FrostCrystal(x, y, angle, cardEffectsCtx));
    }
}

function drawFrost() {
    let heatMultiplier = 1.0;
    if (appState.theme === 'sunny') heatMultiplier = 1.5;
    else if (appState.theme === 'cloudy') heatMultiplier = 1.2;
    const heatRadius = 45 * heatMultiplier;
    const isThemeSnowy = appState.theme === 'snowy';
    for (let i = frostLines.length -1; i>= 0; i--) {
        const crystal = frostLines[i];
        crystal.update(cardEffectsCtx, mouse, heatRadius, isHeaterActive, isThemeSnowy);
        crystal.draw(cardEffectsCtx);
        if (crystal.life <= 0 && crystal.path.length <= 1) frostLines.splice(i, 1);
    }
    if (isThemeSnowy && frostLines.length < 400 && Math.random() < 0.1) {
        const {width, height} = cardEffectsCanvas.getBoundingClientRect();
        let x, y, angle;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = 0; y = Math.random() * height; angle = Math.random() * Math.PI / 2 - Math.PI / 4; }
        else if (side === 1) { x = width; y = Math.random() * height; angle = Math.random() * Math.PI / 2 + Math.PI / 2 + Math.PI / 4; }
        else if (side === 2) { x = Math.random() * width; y = 0; angle = Math.random() * Math.PI / 2 + Math.PI / 4; }
        else { x = Math.random() * width; y = height; angle = Math.random() * Math.PI / 2 - Math.PI - Math.PI / 4; }
        frostLines.push(new FrostCrystal(x, y, angle, cardEffectsCtx));
    }
}