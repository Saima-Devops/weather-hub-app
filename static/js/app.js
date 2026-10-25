const $ = id => document.getElementById(id);

const statusArea = $("statusArea");
const result = $("result");
const scene = $("scene");
const welcomeMsgEl = $("welcomeMsg");
const forecastDiv = $("tonightForecast");

function setStatus(html) {
    statusArea.innerHTML = html;
}

function showLoader() {
    setStatus('<div style="display:flex;align-items:center;gap:12px"><div class="loader"></div>Fetching weather…</div>');
}

function showError(msg) {
    result.style.display = 'none';
    setStatus(`<div class='error'>${msg}</div>`);
}

function chooseEmotion(temp, condition) {
    const c = condition.toLowerCase();
    if (/rain|shower|drizzle/.test(c)) return "🌧️";
    if (/snow|sleet/.test(c)) return "❄️";
    if (/fog|mist|haze/.test(c)) return "🌫️";
    if (temp >= 30) return "🥵";
    if (temp >= 24) return "😎";
    if (temp >= 18) return "🙂";
    if (temp >= 10) return "🧥";
    return "🥶";
}

function craftMessage(temp, condition, name) {
    let mood = "Lovely day!";
    const c = condition.toLowerCase();
    if (/sun|clear/.test(c)) mood = "Bright & sunny — enjoy it!";
    else if (/cloud/.test(c)) mood = "Cloudy vibes — cozy mood.";
    else if (/rain|drizzle/.test(c)) mood = "Rainy — grab an umbrella!";
    else if (/snow/.test(c)) mood = "Magical snow — stay warm!";
    if (temp >= 30) return `${mood} Hot ${temp}°C in ${name}!`;
    if (temp >= 24) return `${mood} Warm ${temp}°C in ${name}.`;
    if (temp >= 18) return `${mood} Pleasant ${temp}°C in ${name}.`;
    if (temp >= 10) return `${mood} Cool ${temp}°C in ${name}.`;
    return `${mood} Cold ${temp}°C in ${name}.`;
}

function updateSceneFor(condition) {
    const c = condition.toLowerCase();
    if (/rain|drizzle|shower/.test(c)) {
        scene.style.background = 'radial-gradient(circle at 30% 20%, #7dd3fc33, transparent 20%), #02202a';
        scene.textContent = '🌧️';
    } else if (/snow|sleet/.test(c)) {
        scene.style.background = '#dbeafe';
        scene.textContent = '❄️';
    } else if (/clear|sun/.test(c)) {
        scene.style.background = '#fef3c7';
        scene.textContent = '☀️';
    } else if (/cloud/.test(c)) {
        scene.style.background = '#cbd5e1';
        scene.textContent = '☁️';
    } else if (/fog|mist|haze/.test(c)) {
        scene.style.background = '#e2e8f0';
        scene.textContent = '🌫️';
    } else {
        scene.style.background = '#cffafe';
        scene.textContent = '🌤️';
    }
}

function displayLocalDateTime(localTimeStr) {
    let localTimeDiv = document.getElementById('localDateTime');

    if (!localTimeDiv) {
        localTimeDiv = document.createElement('div');
        localTimeDiv.id = 'localDateTime';
        localTimeDiv.style.marginTop = '12px';
        localTimeDiv.className = 'small-muted';
        forecastDiv.insertAdjacentElement('afterend', localTimeDiv);
    }
    localTimeDiv.textContent = localTimeStr;

    let travelRecDiv = document.getElementById('travelRecommendation');
    if (!travelRecDiv) {
        travelRecDiv = document.createElement('div');
        travelRecDiv.id = 'travelRecommendation';
        travelRecDiv.style.marginTop = '8px';
        travelRecDiv.style.fontSize = '14px';
        travelRecDiv.style.padding = '10px';
        travelRecDiv.style.borderRadius = '8px';
        travelRecDiv.style.backdropFilter = 'blur(8px)';
        travelRecDiv.style.background = 'rgba(255,255,255,0.1)';
        localTimeDiv.insertAdjacentElement('afterend', travelRecDiv);
    }

    let copyrightDiv = document.getElementById('copyrightNotice');
    if (!copyrightDiv) {
        copyrightDiv = document.createElement('div');
        copyrightDiv.id = 'copyrightNotice';
        copyrightDiv.style.marginTop = '4px';
        copyrightDiv.style.fontSize = '12px';
        copyrightDiv.style.color = 'rgba(255,255,255,0.5)';

    }
}

async function fetchWeather(payload) {
    showLoader();
    try {
        const resp = await fetch('/get_weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        return data;
    } catch (e) {
        throw e;
    }
}

function render(data) {
    result.style.display = '';
    setStatus('');
    welcomeMsgEl.textContent = data.greeting || "🌎 Welcome to World Weather Hub!";

    const loc = `${data.location.name}, ${data.location.region}, ${data.location.country}`;
    const t = Math.round(data.current.temp_c);
    $("tempValue").textContent = `${t}°C`;
    $("locationName").textContent = loc;
    $("conditionText").textContent = data.current.condition;
    $("conditionIcon").src = data.current.icon;
    $("feelsLike").textContent = `Feels like: ${Math.round(data.current.feelslike_c)}°C`;
    $("humidity").textContent = `Humidity: ${data.current.humidity}%`;
    $("wind").textContent = `Wind: ${Math.round(data.current.wind_kph)} kph`;
    $("emo").textContent = chooseEmotion(t, data.current.condition);
    $("messageText").textContent = craftMessage(t, data.current.condition, data.location.name);
    $("recommendation").textContent = data.recommendation;
    updateSceneFor(data.current.condition);

    const nowHour = new Date(data.current.localtime).getHours();
    let forecastToShow = data.tonight;
    let title = "🌙 Tonight Forecast";
    if (nowHour >= 18 || nowHour < 6) title = "🌞 Next Morning Forecast";

    if (forecastToShow) {
        forecastDiv.style.display = '';
        forecastDiv.innerHTML = `
            <h3>${title}</h3>
            <div style="display:flex;align-items:center;gap:12px">
                <img id="forecastIcon" src="${forecastToShow.icon}" alt="forecast icon" style="width:48px;height:48px"/>
                <div>
                    <div id="forecastCondition">${forecastToShow.condition}</div>
                    <div id="forecastTemp">${Math.round(forecastToShow.temp_c)}°C</div>
                    <div id="forecastEmo" style="font-size:28px">${chooseEmotion(forecastToShow.temp_c, forecastToShow.condition)}</div>
                </div>
            </div>
        `;
    } else forecastDiv.style.display = 'none';

    if (data.location.localtime) {
        const localTimeStr = new Date(data.location.localtime).toLocaleString(
            undefined,
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        );
        displayLocalDateTime(localTimeStr);

        const travelRecDiv = document.getElementById('travelRecommendation');
        if (travelRecDiv) {

            const cond = data.current.condition.toLowerCase();
            const t = data.current.temp_c;

            let travelRec = '';
            if (cond.includes('rain')) travelRec = '🌧️🌂 Carry umbrella, waterproof jacket & boots if traveling.';
            else if (cond.includes('snow')) travelRec = '❄️👢 Heavy coat, insulated boots, gloves & thermals recommended.';
            else if (t >= 30) travelRec = '🥵👓 Light clothes, sunglasses, hat & stay hydrated.';
            else if (t >= 24) travelRec = '😎🧢 Summer wear, cap, light shoes & sunscreen are must-haves.';
            else if (t >= 18) travelRec = '🥼🥾 Light jacket & casual comfortable clothings recommended.';
            else if (t >= 10) travelRec = '🧥🥾 Pack Jacket, layers & warm footwear for a cozy travel.';
            else travelRec = '🧥👢 Heavy coat, gloves, scarf & warm boots are essentials.';

            travelRecDiv.innerHTML = `
            <div style="font-size:18px; color:#ffd700; font-weight:bold; margin-bottom:12px;">
                ✈️ Quick Travelling Tip
            </div>
            <div>${travelRec}</div>
        `;
        }
    }

}

const input = $("locationInput");
const btn = $("searchBtn");
btn.addEventListener('click', doSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

async function doSearch() {
    const q = input.value.trim();
    if (!q) return setStatus('Please enter a location.');
    try {
        const data = await fetchWeather({ location: q });
        render(data);
    } catch (err) {
        showError('Unable to fetch weather.');
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async pos => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                try {
                    const data = await fetchWeather({ lat, lon });
                    render(data);
                } catch (err) {
                    setStatus('Unable to fetch weather for your location.');
                }
            }, err => {
                setStatus('Geolocation not allowed. Please search for a city.');
            });
        } else {
            setStatus('Geolocation not supported. Please search for a city.');
        }
    } catch (e) {
        console.error(e);
        setStatus('Error fetching weather.');
    }
});
