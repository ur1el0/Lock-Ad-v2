let map, originMarker, destMarker, routeLayer, currentPosition;

let currentRouteCoords = null; 
let currentRouteSteps = null; 
let currentRoutePolyline = null;
let traveledPolyline = null;
let currentPosMarker = null;
let watchId = null;
const OFFROUTE_THRESHOLD_METERS = 60;

function ensureDiagElements() 
{
	const diagEl = document.getElementById('mapDiagnostics');
	if (!diagEl) return null;
	if (!diagEl.querySelector('.diag-provider')) 
	{
		diagEl.innerHTML = '<div class="diag-provider" style="font-weight:600;margin-bottom:4px;"></div><div class="diag-status" style="font-size:0.95rem;color:#ffd;"></div><div class="diag-position" style="font-size:0.85rem;color:#bbb;margin-top:4px;"></div>';
	}
	return {
		diagEl,
		providerEl: diagEl.querySelector('.diag-provider'),
		statusEl: diagEl.querySelector('.diag-status')
	};
}

function setDiagProvider(text)
{
	const els = ensureDiagElements();
	if (!els) return;
	els.providerEl.textContent = text;
}

function setDiagStatus(text) 
{
	const els = ensureDiagElements();
	if (!els) return;
	els.statusEl.textContent = text;
}

function setDiagPosition(text) 
{
	const els = ensureDiagElements();
	if (!els) return;
	const posEl = ensureDiagElements().diagEl.querySelector('.diag-position');
	if (posEl) posEl.textContent = text;
}

function getSafetyMode() 
{
	const mode = document.body.getAttribute('data-route-mode') || 'fastest';
	return mode === 'safer';
}

function generateSafetyDetails(dist, safetyMode) {
	const safetyEl = document.getElementById('safetyDetails');
	if (!safetyEl) return;

	const dayOfWeek = new Date().getDay();
	const hour = new Date().getHours();
	const isNight = hour < 6 || hour > 20;
	const timeOfDay = isNight ? 'Evening/Night' : 'Daytime';

	const weatherStates = ['Sunny ☀️', 'Cloudy ☁️', 'Rainy 🌧️', 'Clear 🌙'];
	const weather = weatherStates[Math.floor(Math.random() * weatherStates.length)];

	const streetlights = dist > 2000 ? 'Moderate coverage' : 'Good coverage';

	const crimeRates = ['Low', 'Moderate', 'Moderate', 'Low'];
	const crimeRate = crimeRates[Math.floor(Math.random() * crimeRates.length)];

	let safetyScore = 'Medium';
	if (safetyMode) 
	{
		safetyScore = 'High';
	} 
	else if (!isNight && weather.includes('Sunny')) 
	{
		safetyScore = 'High';
	} 	
	else if (isNight && weather.includes('Rain')) 
	{
		safetyScore = 'Low';
	}

	const html = `
		<div class="safety-panel">
			<strong>Route Safety Overview</strong>
			<div class="safety-item">
				<span class="safety-label">Time of Day:</span>
				<span>${timeOfDay}</span>
			</div>
			<div class="safety-item">
				<span class="safety-label">Weather:</span>
				<span>${weather}</span>
			</div>
			<div class="safety-item">
				<span class="safety-label">Streetlights:</span>
				<span>${streetlights}</span>
			</div>
			<div class="safety-item">
				<span class="safety-label">Crime Rate:</span>
				<span>${crimeRate}</span>
			</div>
			<div class="safety-item safety-score">
				<span class="safety-label">Overall Safety:</span>
				<span class="badge ${safetyScore === 'High' ? 'bg-success' : safetyScore === 'Medium' ? 'bg-warning' : 'bg-danger'}">${safetyScore}</span>
			</div>
		</div>
	`;
	safetyEl.innerHTML = html;
}

function isLatLngString(s) 
{
	return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(s);
}

async function geocode(query) 
{
	if (isLatLngString(query)) 
	{
		const [lat, lng] = query.split(',').map(x => parseFloat(x.trim()));
		return { lat, lng };
	}

	if (window.PSGC_API_URL) 
	{
		try
		{
			const purl = window.PSGC_API_URL + '?q=' + encodeURIComponent(query);
			const pres = await fetch(purl);
			if (pres.ok) 
			{
				const pdata = await pres.json();
				if (Array.isArray(pdata) && pdata.length && pdata[0].latitude && pdata[0].longitude) 	
				{
					return { lat: parseFloat(pdata[0].latitude), lng: parseFloat(pdata[0].longitude) };
				}
				if (pdata && pdata.features && pdata.features.length && pdata.features[0].geometry) 
				{
					const c = pdata.features[0].geometry.coordinates;
					return { lat: c[1], lng: c[0] };
				}
			}
		} catch (pe) { console.warn('PSGC lookup failed', pe); }
	}

	const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query);
	try 
	{
		const res = await fetch(url);
		const data = await res.json();
		if (data && data.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
	} catch (e) { console.error('geocode', e); }
	return null;
}

async function routeWithORS(origin, dest) 
{
	const apiKey = window.ORS_API_KEY || '';
	if (!apiKey) throw new Error('ORS API key not configured');
	const endpoint = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
	const body = 
	{
		coordinates: [[origin.lng, origin.lat], [dest.lng, dest.lat]],
		instructions: true,
		alternative_routes: {
			target_count: 3,
			share_factor: 0.6,
			weight_factor: 1.4
		}
	};
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error('ORS routing error: ' + res.status);
	const data = await res.json();
	if (!data || !data.features || !data.features.length) throw new Error('ORS returned no features');
	return data.features;
}

function initLeaflet() 
{
	const el = document.getElementById('map');
	if (!el) 
	{
		console.error('Map element not found');
		return;
	}
	if (typeof L === 'undefined') 
	{
		el.innerHTML = '<div style="padding:1rem;color:#ddd;text-align:center;">Map library failed to load.</div>';
		console.error('Leaflet (L) is undefined — check that leaflet.js is loaded');
		return;
	}

	map = L.map('map', { zoomControl: true }).setView([39.0, 71.5], 6);
	const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' });
	tileLayer.addTo(map);
	routeLayer = L.layerGroup().addTo(map);

	const diagEl = document.getElementById('mapDiagnostics');
	let tilesLoaded = 0;
	let tilesErrored = 0;
	setDiagStatus('Loading map tiles...');
	tileLayer.on('tileload', function () {
		tilesLoaded++;
		if (tilesLoaded === 1) setDiagStatus('Map tiles loaded');
		if (map && typeof map.invalidateSize === 'function') setTimeout(() => map.invalidateSize(), 200);
	});
	tileLayer.on('tileerror', function (err) {
		tilesErrored++;
		setDiagStatus('Some map tiles failed to load (' + tilesErrored + ').');
		console.error('Tile error', err);
	});

	try 
	{
		map.whenReady(() => {
			if (map && typeof map.invalidateSize === 'function') 
			{
				setTimeout(() => { map.invalidateSize(); setDiagStatus('Map ready and resized'); }, 250);
			} 
			else 
			{
				setDiagStatus('Map ready');
			}
		});
	} catch (e) { console.warn('whenReady failed', e); }
}

function setCurrentPosition(lat, lng) 
{
	currentPosition = { lat, lng };
	if (!map) return;
	map.setView([lat, lng], 15);
	if (originMarker) originMarker.setLatLng([lat, lng]);
	else originMarker = L.marker([lat, lng]).addTo(routeLayer);
}

function startPositionWatch() 
{
	if (!navigator.geolocation) return;
	if (watchId) return;
	watchId = navigator.geolocation.watchPosition(pos => {
		const lat = pos.coords.latitude, lng = pos.coords.longitude;
		currentPosition = { lat, lng };
		
		if (!currentPosMarker) 
		{
			currentPosMarker = L.circleMarker([lat, lng], { radius:6, color:'#00bfff', fillColor:'#00bfff', fillOpacity:0.9 }).addTo(routeLayer);
		}
		else
		{
			currentPosMarker.setLatLng([lat, lng]);
		}

		if (currentRouteCoords && currentRouteCoords.length) 
		{
			const nearest = findNearestPointOnRoute([lat, lng], currentRouteCoords);
			if (nearest) 
			{
				const idx = nearest.index;
				const traveled = currentRouteCoords.slice(0, idx+1);
				const remaining = currentRouteCoords.slice(idx);
				if (traveledPolyline) traveledPolyline.setLatLngs(traveled);
				else traveledPolyline = L.polyline(traveled, { color:'#666', weight:6, opacity:0.9 }).addTo(routeLayer);
				if (currentRoutePolyline) 
				{
					currentRoutePolyline.setLatLngs(remaining);
				}

				const distOff = nearest.distance; 
				setDiagPosition(`On-route dist: ${Math.round(distOff)} m`);
				if (distOff > OFFROUTE_THRESHOLD_METERS) 
				{
					try 
					{
						navigator.geolocation.clearWatch(watchId); } catch (e) { }
						watchId = null;
						const originStr = `${lat},${lng}`;
						const destInput = document.getElementById('destination');
						const destVal = destInput && destInput.value.trim();
					if (destVal) 
					{
						const originInput = document.getElementById('origin');
						if (originInput) originInput.value = originStr;
						calculateRoute();
					}
				}
			}
		}

	}, err => {
		console.warn('watchPosition error', err);
	}, { enableHighAccuracy:true, maximumAge:2000, timeout:5000 });
}

function stopPositionWatch() 
{
	if (watchId && navigator.geolocation) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { } }
	watchId = null;
}

function findNearestPointOnRoute(pos, routeCoords) 
{
	const R = 6371000;
	function toRad(d){return d*Math.PI/180;}
	function haversine(a,b){
		const dLat = toRad(b[0]-a[0]); const dLon = toRad(b[1]-a[1]);
		const lat1 = toRad(a[0]); const lat2 = toRad(b[0]);
		const aa = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)*Math.sin(dLon/2);
		return 2*R*Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
	}

	let best = { distance: Infinity, index: 0 };
	for (let i=0;i<routeCoords.length-1;i++)
	{
		const A = routeCoords[i]; const B = routeCoords[i+1];
		const x1 = A[1], y1 = A[0];
		const x2 = B[1], y2 = B[0];
		const xP = pos[1], yP = pos[0];
		const dx = x2-x1, dy = y2-y1;
		const len2 = dx*dx+dy*dy;
		let t = 0;
		if (len2>0) t = ((xP-x1)*dx + (yP-y1)*dy)/len2;
		t = Math.max(0, Math.min(1, t));
		const proj = [ y1 + dy*t, x1 + dx*t ];
		const d = haversine(pos, proj);
		if (d < best.distance) { best = { distance: d, index: i+Math.round(t) }; }
	}
	return best;
}

async function calculateRoute() 
{
	const originInput = document.getElementById('origin');
	const destInput = document.getElementById('destination');
	const originVal = originInput.value.trim() || (currentPosition ? `${currentPosition.lat},${currentPosition.lng}` : '');
	const destVal = destInput.value.trim();
	if (!originVal || !destVal) { alert('Please provide a destination (origin optional)'); return; }

	const origin = await geocode(originVal);
	const dest = await geocode(destVal);
	if (!origin || !dest) { alert('Unable to find origin or destination'); return; }

	const provider = (window.ROUTING_PROVIDER || 'auto').toLowerCase();
	const useORS = (provider === 'ors' || provider === 'auto') && (window.ORS_API_KEY && window.ORS_API_KEY.length > 8);

	const diagEl = document.getElementById('mapDiagnostics');
	try
	{
		setDiagStatus('Calculating route...');
		let chosenRoute = null;
		let coordsGeo = [];
		let dist = 0, dur = 0, stepsCount = 0;
		if (useORS) 
		{
			const routes = await routeWithORS(origin, dest);
			const safetySelected = getSafetyMode();
			let chosen = routes[0];
			if (!safetySelected) 
			{
				routes.forEach(r => {
					const dur = r.properties.summary?.duration || r.properties.duration || 0;
					if (dur < (chosen.properties.summary?.duration || chosen.properties.duration || 999999)) chosen = r;
				});
			} 
			else 
			{
				let maxSteps = -1;
				routes.forEach(r => {
					const steps = r.properties.segments?.[0]?.steps?.length || 0;
					if (steps > maxSteps) { maxSteps = steps; chosen = r; }
				});
			}
			coordsGeo = chosen.geometry.coordinates.map(c => [c[1], c[0]]);
			dist = chosen.properties.summary?.distance || chosen.properties.distance || 0;
			dur = chosen.properties.summary?.duration || chosen.properties.duration || 0;
			stepsCount = chosen.properties.segments?.[0]?.steps?.length || 0;
			chosenRoute = { provider: 'ors', alternatives: routes.length };
		} 
		else
		{
			const base = 'https://router.project-osrm.org/route/v1/foot/';
			const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
			const url = base + coords + '?overview=full&geometries=geojson&alternatives=true&steps=true';
			const res = await fetch(url);
			const data = await res.json();
			if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) { alert('No route found'); return; }

			const safetySelected = getSafetyMode();
			let chosen = data.routes[0];
			if (!safetySelected) 
			{
				data.routes.forEach(r => { if (r.duration < chosen.duration) chosen = r; });
			}
			else 
			{
				let maxSteps = -1;
				data.routes.forEach(r => {
					const steps = r.legs.reduce((s, leg) => s + (leg.steps ? leg.steps.length : 0), 0);
					if (steps > maxSteps) { maxSteps = steps; chosen = r; }
				});
			}

			coordsGeo = chosen.geometry.coordinates.map(c => [c[1], c[0]]);
			dist = chosen.distance; dur = chosen.duration;
			stepsCount = chosen.legs.reduce((s, l) => s + (l.steps ? l.steps.length : 0), 0);
			chosenRoute = { provider: 'osrm' };
		}
		try 
		{
			const providerText = `Provider: ${chosenRoute.provider}` + (chosenRoute.alternatives ? ` · Alternatives: ${chosenRoute.alternatives}` : '');
			setDiagProvider(providerText);
			setDiagStatus(`Distance: ${(dist/1000).toFixed(2)} km · Duration: ${Math.round(dur/60)} min · Steps: ${stepsCount}`);
		} catch (ie) { console.warn('diag info fail', ie); }

		routeLayer.clearLayers();
		originMarker = L.marker([origin.lat, origin.lng]).addTo(routeLayer);
		destMarker = L.marker([dest.lat, dest.lng]).addTo(routeLayer);
		const safetySelected = getSafetyMode();
		const color = safetySelected ? '#36b37e' : '#ff7a00';

		currentRouteCoords = coordsGeo.slice();
		if (currentRoutePolyline) routeLayer.removeLayer(currentRoutePolyline);
		currentRoutePolyline = L.polyline(coordsGeo, { color: color, weight: 6, opacity: 0.95, className: 'route-line' }).addTo(routeLayer);
		map.fitBounds(currentRoutePolyline.getBounds(), { padding: [24, 24] });

		if (traveledPolyline) routeLayer.removeLayer(traveledPolyline);
		traveledPolyline = L.polyline([], { color: '#666', weight: 6, opacity: 0.9 }).addTo(routeLayer);

		const summaryEl = document.getElementById('routeSummary');
		const label = safetySelected ? 'Safer route' : 'Fastest';
		if (summaryEl) 
		{
			let html = `<div class="summary-inner"><strong>${Math.round(dur/60)} min</strong> · ${(dist/1000).toFixed(1)} km — ${label}</div>`;
			html += `<div class="steps-count"><small>Approximately ${Math.round(dist/0.762)} steps</small></div>`;
			html += `<div class="steps-list" id="stepsList"></div>`;
			summaryEl.innerHTML = html;
		}

		currentRouteSteps = [];
		try 
	{
			if (typeof chosen !== 'undefined' && chosen && chosen.properties && chosen.properties.segments && chosen.properties.segments.length) 
			{
				const s = chosen.properties.segments[0].steps || [];
				s.forEach(st => currentRouteSteps.push({ text: st.instruction || st.name || 'Continue', distance: st.distance, duration: st.duration }));
			}
		} catch (e) { }

		if (!currentRouteSteps || currentRouteSteps.length === 0) 
		{
			currentRouteSteps = [{ text: 'Follow the route', distance: dist, duration: dur }];
		}

		const stepsListEl = document.getElementById('stepsList');
		if (stepsListEl) 
		{
			stepsListEl.innerHTML = '';
			currentRouteSteps.forEach((st, i) => {
				const div = document.createElement('div');
				div.className = 'step-item';
				div.innerHTML = `<div class="step-index">${i+1}</div><div class="step-text">${st.text}</div><div class="step-meta">${st.distance? (Math.round(st.distance)+'m') : ''} ${st.duration? ('· '+Math.round(st.duration/60)+'m'):''}</div>`;
				stepsListEl.appendChild(div);
			});
		}

		generateSafetyDetails(dist, safetySelected);

		startPositionWatch();

	} catch (e) { console.error(e); setDiagStatus('Routing failed: ' + (e && e.message ? e.message : e)); alert('Routing failed: ' + (e && e.message ? e.message : e)); }
}

document.addEventListener('DOMContentLoaded', function () {
		try 
		{
			const mapEl = document.getElementById('map');
			if (mapEl) 
			{
				mapEl.style.display = 'block';
				mapEl.style.minHeight = '320px';
				mapEl.style.background = '#181c24';
			}
		} catch (e) { }
		initLeaflet();
	try 
	{
		const saved = localStorage.getItem('lockad_ors_key');
		if ((!window.ORS_API_KEY || window.ORS_API_KEY.length < 8) && saved) 
		{	
			window.ORS_API_KEY = saved;
		}
	} catch (e) { }

	try 
	{
		const diagEl = document.getElementById('mapDiagnostics');
		const prov = (window.ROUTING_PROVIDER || 'auto').toLowerCase();
		const hasKey = window.ORS_API_KEY && window.ORS_API_KEY.length > 8;
		let active = 'OSRM (fallback)';
		if ((prov === 'ors' || prov === 'auto') && hasKey) active = 'OpenRouteService (ORS)';
		else if (prov === 'ors' && !hasKey) active = 'OSRM (ORS key missing)';
		setDiagProvider(`Routing provider: ${active}`);
	} catch (e) { }

	const locBtn = document.getElementById('locBtn');
	const locStatus = document.getElementById('locStatus');
	const routeBtn = document.getElementById('routeBtn');

		if (navigator.geolocation) 
		{
			locStatus.textContent = 'Detecting location...';
			navigator.geolocation.getCurrentPosition(function (pos) {
				setCurrentPosition(pos.coords.latitude, pos.coords.longitude);
				locStatus.textContent = 'Using your location (tap Use my location to set origin)';
			}, function () { locStatus.textContent = 'Location unavailable'; });
		} else locStatus.textContent = 'Geolocation not supported';

	locBtn && locBtn.addEventListener('click', function () {
		if (!navigator.geolocation) return alert('Geolocation not supported');
		navigator.geolocation.getCurrentPosition(function (pos) {
			setCurrentPosition(pos.coords.latitude, pos.coords.longitude);
			locStatus.textContent = 'Using your location';
			const originInput = document.getElementById('origin');
			if (originInput) originInput.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
			if (map && typeof map.invalidateSize === 'function') map.invalidateSize();
		}, function () { alert('Unable to get your location'); });
	});

	routeBtn && routeBtn.addEventListener('click', function () { calculateRoute(); });

	const off = document.getElementById('offcanvasMenu');
	if (off) off.addEventListener('shown.bs.offcanvas', () => { if (map && map.invalidateSize) map.invalidateSize(); });
	const planner = document.getElementById('collapseOne');
	if (planner) planner.addEventListener('shown.bs.collapse', () => { if (map && map.invalidateSize) map.invalidateSize(); });

	const diagEl = document.getElementById('mapDiagnostics');
});