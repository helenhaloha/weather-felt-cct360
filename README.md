# Weather, Felt

**Weather, Felt** is an interactive weather portrait created for CCT360 Project 2: Designing With Data. Live data does more than appear as numbers. It changes the colour, motion, texture, light, and language of the experience.

- Live site: https://helenhaloha.github.io/weather-felt-cct360/
- Repository: https://github.com/helenhaloha/weather-felt-cct360

## Live API

The project uses two public Open-Meteo endpoints. Neither endpoint requires an API key.

- Forecast API: `https://api.open-meteo.com/v1/forecast`
- Geocoding API: `https://geocoding-api.open-meteo.com/v1/search`

Open-Meteo documentation: https://open-meteo.com/en/docs

## Data-driven interface properties

1. **Colour palette:** temperature, weather code, and day/night status select the sky gradient and accent colour.
2. **Particle behaviour:** precipitation and weather code create rain, snow, haze, or clear-air particles.
3. **Motion:** wind speed and direction change particle velocity and direction.
4. **Clouds and humidity:** cloud cover adjusts particle density; humidity appears in the live metrics.
5. **Text:** live values update the condition, metrics, and atmospheric sentence.
6. **Light:** local forecast time and day/night status move and restyle the celestial body.

## User interactions

- Search for any city through the geocoding API.
- Select one of four preset cities.
- Select an hour in the 12-hour forecast to reshape the scene.
- Switch between Celsius and Fahrenheit.
- Pause or resume atmospheric motion.
- Reveal the selected live JSON data.

## Files

- `index.html` contains the semantic page structure.
- `style.css` contains the responsive visual system and reduced-motion support.
- `script.js` retrieves JSON, transforms weather data, manages interactions, and renders the atmospheric canvas.

## Running locally

Serve this folder from a local web server so browser `fetch()` requests work consistently.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Credits

- Design and development: Helen Wei, Madhav Chandgothia, and Ricardo Chen
- Weather and geocoding data: Open-Meteo, used for this non-commercial student project
- Typography: system fonts only
- Visuals: original CSS and Canvas rendering; no external media assets
