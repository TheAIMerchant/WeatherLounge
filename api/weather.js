export default async function handler(req, res) {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apikey) {
        return res.status(500).json({message: "API key not configured."});
    }
    const {type, city, lat, lon} = req.query;
    let apiUrl;

    if (type === 'geo') {
        apiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
    }
    else if (type === 'weather') {
        apiUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely,hourly,daily,alerts&appid=${apiKey}`;
    }
    else if (type === 'reverseGeo') {
        apiUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
    }
    else {
        return res.status(400).json({message: 'Invalid request type'});
    }

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.status(200).json(data);
    }

    catch (error) {
        console.error('API route error:', error);
        res.status(500).json({message: 'Internal Server Error'});
    }
}