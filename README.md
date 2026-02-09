# Weather Lounge
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://weather-lounge.vercel.app/)
> **[Try the Live Experience Here](https://weather-lounge.vercel.app/)**
## The Concept
Weather Lounge is an attempt at 'gamifying' the weather by creating a living, interactive environment instead of a static data dashboard.



## Features

1. Weather Recall: Accurate data fetching via OpenWeather.
2. Time Manipulation: An interactive clock that allows users to manually scrub through the day, triggering sunrise, midday, and sunset lighting transitions.
3. Celestial Tracking: The Sun and Moon follow calculated arc paths based on the time of day
4. Interactive Weather Themes: Particle-based rain, snow, and lightning systems.
5. Reactive Environment: Atmospheric conditions affect the scene visuals (e.g., stars twinkle at night, shooting stars appear, and foreground saturation shifts with the light).
6. Interactive Tools:
    1. Umbrella: Uses a collision-style radius to block rain and snow particles.
    2. Heater: Melts frost off the glass and creates steam/smoke effects.
    3. Torch: A dynamic "light" mask that follows the cursor in dark themes.
    4. Logic Loops: Tools react to weather (e.g., heavy rain can extinguish the heater).


## Technology

1. HTML5 / CSS3
2. JavaScript (Vanilla)
3. HTML5 Canvas (Used for particle rendering and sky gradients)
4. Icons from Skycons
5. Data from OpenWeather API
6. Deployed on Vercel


## Potential Future Roadmap

1. Accumulation Systems: Allowing snow/water to build up on the whole UI - not just the weather card - and rain to create a 'flood' effect.
2. The Bucket: A tool to scoop or clear accumulated water/snow.
3. Dynamic Scenery: Multiple background scenes that change based on the specific climate of the searched location.