# Lock-Ad

A modern, user-friendly navigation web application designed to help users find the **fastest** or **safest** routes based on their preferences. Lock-Ad provides an intuitive interface for route planning with support for real-time route calculation and multiple routing algorithms.

## Features

- **Dual Route Modes**: Choose between fastest or safest route optimization
- **Location-Based Navigation**: Use your current location or select a custom starting point
- **Interactive Map**: Leaflet-powered map with route visualization and controls
- **API Integration**: Supports OSRM (public) and OpenRouteService (ORS) routing engines
- **Dark/Light Mode**: Toggle between dark and light themes for comfortable viewing
- **Settings Management**: Customize routing preferences and API keys
- **Responsive Design**: Fully responsive layout that works on desktop, tablet, and mobile devices

## Project Structure

```
Lock-Ad-v2/
├── index.html              # Home page with hero section
├── css/
│   ├── index.css           # Homepage styles (light mode overrides included)
│   ├── map.css             # Map page styles
│   ├── navbar.css          # Navigation bar styles
│   ├── settings.css        # Settings page styles
│   └── about.css           # About page styles
├── js/
│   ├── index.js            # Homepage functionality and theme management
│   └── [other page scripts]
├── pages/
│   ├── map-fastest.html    # Fastest route map page
│   ├── map-safer.html      # Safer route map page
│   ├── settings.html       # User settings page
│   ├── about.html          # About page
│   └── map.html            # Redirect to map-fastest.html
├── assets/
│   ├── globe.jpg           # Background image for hero section
│   ├── lock-ad-logo.png    # Application logo
│   └── [other assets]
└── README.md               # This file
```

## Pages Overview

### Home Page (`index.html`)
The landing page features:
- Full-screen hero section with globe imagery
- Clear call-to-action button
- Theme toggle functionality

### Map Pages (`pages/map-fastest.html`, `pages/map-safer.html`)
Interactive route planning pages with:
- Leaflet-based interactive map
- Route input controls (start/end locations)
- Route display and statistics
- Responsive sidebar navigation
- Theme support

### Settings Page (`pages/settings.html`)
User configuration options:
- Theme toggle (Dark/Light mode)
- API key management for OpenRouteService
- Route preference settings

### About Page (`pages/about.html`)
Information about the application, features, and usage

## Technology Stack

- **Frontend Framework**: HTML5, CSS3, JavaScript (Vanilla)
- **UI Framework**: Bootstrap 5.3.3
- **Icons**: Bootstrap Icons 1.11.0
- **Typography**: Playfair Display (serif), Inter (sans-serif)
- **Map Library**: Leaflet 1.9.4
- **Routing Engines**:
  - OSRM (Open Source Routing Machine) - Default, public API
  - OpenRouteService (ORS) - Optional, requires API key
- **Storage**: localStorage for user preferences and API keys

## Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Internet connection (for CDN resources and routing APIs)

### Installation

1. Clone or download the repository:
```bash
git clone <repository-url>
cd Lock-Ad-v2
```

2. Open `index.html` in your web browser:
   - **Option 1**: Double-click `index.html`
   - **Option 2**: Use a local server (recommended):
     ```bash
     # Using Python 3
     python -m http.server 8000
     
     # Using Python 2
     python -m SimpleHTTPServer 8000
     
     # Using Node.js (with http-server installed)
     http-server
     ```
   - Then navigate to `http://localhost:8000`

### Optional: Adding OpenRouteService API Key

1. Sign up for a free account at [OpenRouteService](https://openrouteservice.org/)
2. Get your API key from the dashboard
3. In the app:
   - Go to Settings page
   - Paste your ORS API key in the input field
   - Click "Save ORS Key"
   - The key is stored locally in your browser

## Usage

### Finding a Route

1. **Start the App**: Open `index.html` and click "Get started"
2. **Choose Route Type**: Select either "Fastest route" or "Safer route"
3. **Set Locations**:
   - Click on the map or use the location input
   - Use "Current Location" button to auto-fill your starting point
4. **View Results**: The route will be calculated and displayed on the map
5. **Switch Theme**: Use the settings or theme toggle to switch between dark and light modes

### Managing Settings

- Open the Settings page from any navigation menu
- Toggle dark/light mode
- Add or remove your OpenRouteService API key
- Clear stored preferences if needed

## Styling and Themes

The application supports two themes:

### Dark Mode (Default)
- Background: `#071022`
- Text: `#e6eef8`
- Accent: `#ff7a00` to `#ff3d6b`

### Light Mode
- Background: `#f5f7fa`
- Text: `#1a202c`
- Accent: `#ff8a2b`

All theme styles are externalized in CSS files with `body.light-mode` overrides.

## JavaScript Files

The project uses modular JavaScript organized by page:
- `js/index.js` - Theme management, navigation, and homepage interactions
- Additional scripts for map functionality and settings management

## API Integration

### OSRM (Default)
- **Service**: Open Source Routing Machine
- **Public API**: `https://router.project-osrm.org/`
- **No authentication required**
- **Features**: Fast route calculation

### OpenRouteService (Optional)
- **Service**: OpenRouteService
- **Documentation**: https://openrouteservice.org/
- **Requires**: API key (free tier available)
- **Features**: Alternative routes, detailed instructions, and more

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Considerations

- Lazy loading of external libraries (Bootstrap, Leaflet)
- Minimal CSS with external stylesheets (no inline styles)
- Efficient DOM manipulation with vanilla JavaScript
- LocalStorage for client-side state management

## Troubleshooting

### Routes not appearing on the map
- Check internet connection
- Verify routing service is accessible
- Try refreshing the page
- Check browser console for errors

### API key not working
- Verify API key is correct in Settings
- Check that the key hasn't expired (ORS)
- Confirm the key has routing permissions enabled
- The app will fall back to OSRM if ORS fails

### Theme not persisting
- Check if localStorage is enabled in browser
- Clear browser cache and try again
- Check browser's storage quota

## Future Enhancements

- [ ] Offline map support
- [ ] Route sharing functionality
- [ ] Saved favorite routes
- [ ] More detailed safety metrics
- [ ] Public transit integration
- [ ] Accessibility improvements (WCAG 2.1 AA)
- [ ] Progressive Web App (PWA) features

## License

[Specify your license here]

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Submit a pull request

## Support

For issues, questions, or suggestions:
1. Check existing issues on GitHub
2. Open a new issue with detailed description
3. Include browser and OS information
4. Provide steps to reproduce

## Changelog

### v2.0
- Initial release of Lock-Ad v2
- Dark/Light theme support
- OSRM and OpenRouteService integration
- Responsive map interface
- Settings management

---

**Last Updated**: 2024
**Version**: 2.0