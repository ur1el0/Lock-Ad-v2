let map, originMarker, destMarker, routeLayer, currentPosition;

function isLatLngString(s) {
	return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(s);
}

async function geocode(query) {
	if (isLatLngString(query)) {
		const [lat, lng] = query.split(',').map(x => parseFloat(x.trim()));
		return { lat, lng };
	}

	if (window.PSGC_API_URL) {
		try {
			const purl = window.PSGC_API_URL + '?q=' + encodeURIComponent(query);
			const pres = await fetch(purl);
			if (pres.ok) {
				const pdata = await pres.json();
				if (Array.isArray(pdata) && pdata.length && pdata[0].latitude && pdata[0].longitude) {
					return { lat: parseFloat(pdata[0].latitude), lng: parseFloat(pdata[0].longitude) };
				}
				if (pdata && pdata.features && pdata.features.length && pdata.features[0].geometry) {
					const c = pdata.features[0].geometry.coordinates; // [lng,lat]
					return { lat: c[1], lng: c[0] };
				}
			}
		} catch (pe) { console.warn('PSGC lookup failed', pe); }
	}

	const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query);
	try {
		const res = await fetch(url);
		const data = await res.json();
		if (data && data.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
	} catch (e) { console.error('geocode', e); }
	return null;
}

async function routeWithORS(origin, dest) {
	const apiKey = window.ORS_API_KEY || '';
	if (!apiKey) throw new Error('ORS API key not configured');
	const endpoint = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
	const body = {
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

function initLeaflet() {
	const el = document.getElementById('map');
	if (!el) {
		console.error('Map element not found');
		return;
	}
	if (typeof L === 'undefined') {
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
	function diag(msg) { if (diagEl) diagEl.textContent = msg; else console.log(msg); }
	diag('Loading map tiles...');
	tileLayer.on('tileload', function () {
		tilesLoaded++;
		if (tilesLoaded === 1) diag('Map tiles loaded');
		if (map && typeof map.invalidateSize === 'function') setTimeout(() => map.invalidateSize(), 200);
	});
	tileLayer.on('tileerror', function (err) {
		tilesErrored++;
		diag('Some map tiles failed to load (' + tilesErrored + ').');
		console.error('Tile error', err);
	});

	try {
		map.whenReady(() => {
			if (map && typeof map.invalidateSize === 'function') {
				setTimeout(() => { map.invalidateSize(); diag('Map ready and resized'); }, 250);
			} else {
				diag('Map ready');
			}
		});
	} catch (e) { console.warn('whenReady failed', e); }
}

function setCurrentPosition(lat, lng) {
	currentPosition = { lat, lng };
	if (!map) return;
	map.setView([lat, lng], 15);
	if (originMarker) originMarker.setLatLng([lat, lng]);
	else originMarker = L.marker([lat, lng]).addTo(routeLayer);
}

async function calculateRoute() {
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
	try {
		if (diagEl) diagEl.textContent = 'Calculating route...';
		let chosenRoute = null;
		let coordsGeo = [];
		let dist = 0, dur = 0, stepsCount = 0;
		if (useORS) {
			const routes = await routeWithORS(origin, dest);
			const safetySelected = document.getElementById('safety') && document.getElementById('safety').checked;
			let chosen = routes[0];
			if (!safetySelected) {
				routes.forEach(r => {
					const dur = r.properties.summary?.duration || r.properties.duration || 0;
					if (dur < (chosen.properties.summary?.duration || chosen.properties.duration || 999999)) chosen = r;
				});
			} else {
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
		} else {
			const base = 'https://router.project-osrm.org/route/v1/foot/';
			const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
			const url = base + coords + '?overview=full&geometries=geojson&alternatives=true&steps=true';
			const res = await fetch(url);
			const data = await res.json();
			if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) { alert('No route found'); return; }

			const safetySelected = document.getElementById('safety') && document.getElementById('safety').checked;
			let chosen = data.routes[0];
			if (!safetySelected) {
				data.routes.forEach(r => { if (r.duration < chosen.duration) chosen = r; });
			} else {
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
		try {
			let info = [];
			info.push(`Provider: ${chosenRoute.provider}`);
			if (chosenRoute.alternatives) info.push(`Alternatives: ${chosenRoute.alternatives}`);
			info.push(`Distance: ${(dist/1000).toFixed(2)} km`);
			info.push(`Duration: ${Math.round(dur/60)} min`);
			info.push(`Steps (approx): ${stepsCount}`);
			if (diagEl) diagEl.innerHTML = '<div>' + info.join(' · ') + '</div>';
		} catch (ie) { console.warn('diag info fail', ie); }

		routeLayer.clearLayers();
		originMarker = L.marker([origin.lat, origin.lng]).addTo(routeLayer);
		destMarker = L.marker([dest.lat, dest.lng]).addTo(routeLayer);
		const safetySelected = document.getElementById('safety') && document.getElementById('safety').checked;
		const color = safetySelected ? '#36b37e' : '#ff7a00';
		const poly = L.polyline(coordsGeo, { color: color, weight: 6, opacity: 0.95, className: 'route-line' }).addTo(routeLayer);
		map.fitBounds(poly.getBounds(), { padding: [24, 24] });

		const summaryEl = document.getElementById('routeSummary');
		const label = safetySelected ? 'Safer route' : 'Fastest';
		if (summaryEl) summaryEl.innerHTML = `<div class="summary-inner"><strong>${Math.round(dur/60)} min</strong> · ${(dist/1000).toFixed(1)} km — ${label}</div>`;

	} catch (e) { console.error(e); if (diagEl) diagEl.textContent = 'Routing failed: ' + (e && e.message ? e.message : e); alert('Routing failed: ' + (e && e.message ? e.message : e)); }
}

document.addEventListener('DOMContentLoaded', function () {
		try {
			const mapEl = document.getElementById('map');
			if (mapEl) {
				mapEl.style.display = 'block';
				mapEl.style.minHeight = '320px';
				mapEl.style.background = '#181c24';
			}
		} catch (e) { }
		initLeaflet();
	try {
		const saved = localStorage.getItem('lockad_ors_key');
		if ((!window.ORS_API_KEY || window.ORS_API_KEY.length < 8) && saved) {
			window.ORS_API_KEY = saved;
			console.info('Loaded ORS key from localStorage');
		}
	} catch (e) { }

	try {
		const diagEl = document.getElementById('mapDiagnostics');
		const prov = (window.ROUTING_PROVIDER || 'auto').toLowerCase();
		const hasKey = window.ORS_API_KEY && window.ORS_API_KEY.length > 8;
		let active = 'OSRM (fallback)';
		if ((prov === 'ors' || prov === 'auto') && hasKey) active = 'OpenRouteService (ORS)';
		else if (prov === 'ors' && !hasKey) active = 'OSRM (ORS key missing)';
		if (diagEl) diagEl.textContent = `Routing provider: ${active}`;
	} catch (e) { }

	const locBtn = document.getElementById('locBtn');
	const locStatus = document.getElementById('locStatus');
	const routeBtn = document.getElementById('routeBtn');

	if (navigator.geolocation) {
		locStatus.textContent = 'Detecting location...';
		navigator.geolocation.getCurrentPosition(function (pos) {
			setCurrentPosition(pos.coords.latitude, pos.coords.longitude);
			locStatus.textContent = 'Using your location';
			const originInput = document.getElementById('origin');
			if (originInput && !originInput.value) originInput.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
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

	const orsInput = document.getElementById('orsKeyInput');
	const orsSave = document.getElementById('orsKeySave');
	const orsClear = document.getElementById('orsKeyClear');
	const diagEl = document.getElementById('mapDiagnostics');

	if (orsInput) {
		if (window.ORS_API_KEY && window.ORS_API_KEY.length > 8) orsInput.value = window.ORS_API_KEY;
		else {
			try { const s = localStorage.getItem('lockad_ors_key'); if (s) orsInput.value = s; } catch (e) { }
		}
	}
	if (orsSave) {
		orsSave.addEventListener('click', () => {
			const v = (orsInput && orsInput.value) ? orsInput.value.trim() : '';
			if (!v) return alert('Please paste your ORS API key');
			window.ORS_API_KEY = v;
			window.ROUTING_PROVIDER = 'ors';
			try { localStorage.setItem('lockad_ors_key', v); } catch (e) { }
			if (diagEl) diagEl.textContent = 'ORS API key saved — provider set to ORS';
		});
	}
	if (orsClear) {
		orsClear.addEventListener('click', () => {
			try { localStorage.removeItem('lockad_ors_key'); } catch (e) { }
			window.ORS_API_KEY = '';
			if (orsInput) orsInput.value = '';
			window.ROUTING_PROVIDER = 'osrm';
			if (diagEl) diagEl.textContent = 'ORS API key cleared — using OSRM fallback';
		});
	}
});


