import React, { useEffect, useState, useRef } from 'react';
import './index.css';
import { firebaseService } from './firebase';
import FloodEventFormModal from './components/FloodEventFormModal';

// Declare Leaflet types for TypeScript
declare global {
  interface Window {
    L: any;
  }
}

interface ForecastDay {
  date: string;
  dayName: string;
  temperature: {
    min: number;
    max: number;
  };
  humidity: number;
  precipitation: number;
  windSpeed: number;
  description: string;
  icon: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  windDirection?: number;
  precipitation: number;
  pressure: number;
  visibility: number;
  feelsLike: number;
  uvIndex?: number;
  cloudiness: number;
  dewPoint?: number;
}

interface MonitoredArea {
  id: string;
  name: string;
  type: string;
  floodRisk: string;
  landslideRisk?: string;
  population?: number;
  notes?: string;
  coordinates: [number, number];
  polygonData?: any; // Store polygon coordinates for persistence
  simulatedFloodRisk?: string;
  simulatedLandslideRisk?: string;
  isSimulated?: boolean;
}

const App: React.FC = () => {
  const mapInstanceRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [monitoredAreas, setMonitoredAreas] = useState<MonitoredArea[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [pendingMarkerLocation, setPendingMarkerLocation] = useState<[number, number] | null>(null);
  const [pendingDrawnLayer, setPendingDrawnLayer] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFloodEventFormModalOpen, setIsFloodEventFormModalOpen] = useState(false);
  const [selectedAreaForFloodReport, setSelectedAreaForFloodReport] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentSimulation, setCurrentSimulation] = useState<string | null>(null);
  const [iconSize, setIconSize] = useState<number>(50);
  const [realTimeSimulationEnabled, setRealTimeSimulationEnabled] = useState<boolean>(true);
  // Function to get area type icon
  const getAreaTypeIcon = (areaType: string): string => {
    const iconMap: { [key: string]: string } = {
      residential: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
      'single-house': `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
      commercial: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`,
      infrastructure: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
      landmark: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
      river: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.73v2.54c.6-.35 1-.99 1-1.73 0-1.1.9-2 2-2s2 .9 2 2c0 .74-.4 1.38-1 1.73v2.54c.6-.35 1-.99 1-1.73 0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2c-.74 0-1.38-.4-1.73-1H15.73c-.35.6-.99 1-1.73 1s-1.38-.4-1.73-1H10.73c-.35.6-.99 1-1.73 1s-1.38-.4-1.73-1H5.73C5.38 14.6 4.74 15 4 15c-1.1 0-2-.9-2-2s.9-2 2-2c.74 0 1.38.4 1.73 1h1.54c.35-.6.99-1 1.73-1s1.38.4 1.73 1h1.54c.35-.6.99-1 1.73-1s1.38.4 1.73 1h1.54c.35-.6.99-1 1.73-1 1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`,
      'water-stream': `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.73v2.54c.6-.35 1-.99 1-1.73 0-1.1.9-2 2-2s2 .9 2 2c0 .74-.4 1.38-1 1.73v2.54c.6-.35 1-.99 1-1.73 0-1.1.9-2 2-2s2 .9 2 2--.9 2-2 2c-.74 0-1.38-.4-1.73-1H15.73c-.35.6-.99 1-1.73 1s-1.38-.4-1.73-1H10.73c-.35.6-.99 1-1.73 1s-1.38-.4-1.73-1H5.73C5.38 14.6 4.74 15 4 15c-1.1 0-2-.9-2-2s.9-2 2-2c.74 0 1.38.4 1.73 1h1.54c.35-.6.99-1 1.73-1s1.38.4 1.73 1h1.54c.35-.6.99-1 1.73-1s1.38.4 1.73 1h1.54c.35-.6.99-1 1.73-1 1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`,
      bridge: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H9v4l3 2 3-2v-4zM4 16l4-4v3h8v-3l4 4-4 4v-3H8v3l-4-4z"/></svg>`,
      road: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 15H4v-2h16v2zm0-5H4V8h16v2zM4 4v2h16V4H4z"/></svg>`,
      slope: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>`,
      agricultural: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
      other: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
    };
    return iconMap[areaType] || iconMap.other;
  };


  // Add a ref to track the current map click handler
  const mapClickHandlerRef = useRef<any>(null);
  
  // Add refs for simulation functions to avoid stale closures
  const simulationFunctionsRef = useRef<any>({});

  // Load areas from Firebase
  const loadAreasFromStorage = async (): Promise<MonitoredArea[]> => {
    try {
      return await firebaseService.loadMonitoredAreas();
    } catch (error) {
      console.error('Error loading areas from Firebase:', error);
      return [];
    }
  };

  // Save areas to Firebase
  const saveAreasToStorage = async (areas: MonitoredArea[]) => {
    try {
      await firebaseService.saveMonitoredAreas(areas);
    } catch (error) {
      console.error('Error saving areas to Firebase:', error);
    }
  };

  // Load flood records from Firebase
  const loadFloodRecords = async (): Promise<any[]> => {
    try {
      return await firebaseService.loadFloodRecords();
    } catch (error) {
      console.error('Error loading flood records from Firebase:', error);
      return [];
    }
  };

  // Load disregard records from Firebase
  const loadDisregardRecords = async (): Promise<any[]> => {
    try {
      return await firebaseService.loadDisregardRecords();
    } catch (error) {
      console.error('Error loading disregard records from Firebase:', error);
      return [];
    }
  };

  // Add marker to map function
  const addMarkerToMap = (area: MonitoredArea, size: number = iconSize) => {
  if (!mapInstanceRef.current) return null;

  const riskColor =
    area.floodRisk === 'high'
      ? '#dc2626'
      : area.floodRisk === 'medium'
      ? '#f59e0b'
      : '#10b981';

  const iconHtml = getAreaTypeIcon(area.type); // ✅ make sure we grab the correct icon

  const customIcon = window.L.divIcon({
    className: 'custom-marker-icon',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${riskColor};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.4}px;
        color: white;
        font-weight: bold;
      ">
        ${iconHtml}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });

  const marker = window.L.marker(area.coordinates, { icon: customIcon }).addTo(mapInstanceRef.current);
  marker.areaData = area;

  // ✅ Popup with icon + name
  const popupContent = `
    <div style="font-family: Inter, sans-serif; background: #071624; color: white; padding: 1rem; border-radius: 8px; border: 1px solid rgba(35, 110, 178, 0.3);">
      <h3 style="margin: 0 0 8px 0; color: white; font-size: 16px; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 18px;">${iconHtml}</span>
        ${area.name}
      </h3>
      <p style="margin: 4px 0; color: rgba(255,255,255,0.7); font-size: 14px;">Type: ${area.type}</p>
      <p style="margin: 4px 0; color: rgba(255,255,255,0.7); font-size: 14px;">Flood Risk: <span style="color: ${
        area.floodRisk === 'high' ? '#dc2626' : area.floodRisk === 'medium' ? '#f59e0b' : '#10b981'
      }; font-weight: 600;">${area.floodRisk}</span></p>
      ${area.population ? `<p style="margin: 4px 0; color: rgba(255,255,255,0.7); font-size: 14px;">Population: ${area.population}</p>` : ''}
      ${area.notes ? `<p style="margin: 4px 0; color: rgba(255,255,255,0.7); font-size: 14px;">Notes: ${area.notes}</p>` : ''}
    </div>
  `;

  marker.bindPopup(popupContent);

  return marker;
};



  // Theme toggle function - moved up before useEffect
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    const body = document.body;
    const themeSwitch = document.getElementById('themeSwitch');
    
    if (newTheme) {
      // Dark mode
      body.classList.remove('light-mode');
      themeSwitch?.classList.remove('active');
    } else {
      // Light mode
      body.classList.add('light-mode');
      themeSwitch?.classList.add('active');
    }
    
    // Save theme preference to Firebase
    firebaseService.saveThemePreference(newTheme ? 'dark' : 'light').catch(error => {
      console.error('Error saving theme preference to Firebase:', error);
    });
  };

  // Initialize map
 useEffect(() => {
    if (mapInstanceRef.current) return;

    // Wait for Leaflet to be available
    const initMap = async () => {
      if (typeof window.L === 'undefined') {
        setTimeout(initMap, 100);
        return;
      }

      const mapElement = document.getElementById('map');
      if (!mapElement) {
        setTimeout(initMap, 100);
        return;
      }



      // Initialize map centered on Oras, Eastern Samar
      const map = window.L.map('map').setView([12.1113, 125.3756], 17);

      // Restrict view to 5km radius
const center: [number, number] = [12.1113, 125.3756];
const radius = 3000; // 20 km
const earthRadius = 6371000;

const latOffset = (radius / earthRadius) * (180 / Math.PI);
const lngOffset =
  (radius / (earthRadius * Math.cos((center[0] * Math.PI) / 180))) *
  (180 / Math.PI);

const bounds = window.L.latLngBounds(
  [center[0] - latOffset, center[1] - lngOffset],
  [center[0] + latOffset, center[1] + lngOffset]
);

map.setMaxBounds(bounds);
map.setMinZoom(15); // Prevent excessive zoom out for better focus on monitored area


// Base layers
const osm = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map); // default

const esriSat = window.L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri",
    maxZoom: 19,
  }
);

const cartoLight = window.L.tileLayer(
  "https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/'>CARTO</a>",
    subdomains: "abcd",
    maxZoom: 19,
  }
);

const cartoDark = window.L.tileLayer(
  "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }
);

// BaseMaps collection
const baseMaps = {
  "OpenStreetMap": osm,
  "Satellite (Esri)": esriSat,
  "Light": cartoLight,
  "Dark": cartoDark,
};

// Add control below zoom
window.L.control.layers(baseMaps, {}, { position: "topleft" }).addTo(map);



      map.on('mousemove', (e: any) => {
  const coordsDiv = document.getElementById('cursorCoordinates');
  if (coordsDiv) {
    coordsDiv.innerText = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
  }
});

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Initialize FeatureGroup to store editable layers
      const drawnItems = new window.L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      // Initialize the draw control
      const drawControl = new window.L.Control.Draw({
        position: 'topleft',
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: '#e1e100',
              message: '<strong>Oh snap!<strong> you can\'t draw that!'
            },
            shapeOptions: {
              color: '#97009c'
            }
          },
          polyline: false,
          rectangle: {
            shapeOptions: {
              clickable: false
            }
          },
          circle: false,
          marker: true,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItems,
          remove: true
        }
      });

      drawControlRef.current = drawControl;

      // Store map reference for click handler management
      mapInstanceRef.current = map;

        // Load areas from storage or use sample data
        const storedAreas = await loadAreasFromStorage();
        const areasToLoad: MonitoredArea[] = storedAreas.length > 0 ? storedAreas : [];

     
        // 🔥 Reset any simulation state before using them
        areasToLoad.forEach((area: MonitoredArea) => {
          area.simulatedFloodRisk = undefined;
          area.isSimulated = false;
        });

      
      // Add markers to map
      // Add markers / polygons to map
areasToLoad.forEach(area => {
  // If this area has polygon geometry, recreate polygon and bind popup — DO NOT add a marker
  if (area.polygonData && drawnItemsRef.current) {
    const riskColor =
      area.floodRisk === 'high' ? '#dc2626' :
      area.floodRisk === 'medium' ? '#f59e0b' : '#10b981';

    const polygon = window.L.polygon(area.polygonData, {
      fillColor: riskColor,
      color: riskColor,
      weight: 3,
      opacity: 0.8,
      fillOpacity: 0.3
    });

    drawnItemsRef.current.addLayer(polygon);
    polygon.areaData = area;
    const iconHtml = getAreaTypeIcon(area.type);

    // Bind same popup content you use when saving (so polygons have popups on reload)
    const popupContent = `
      <div style="font-family: Inter, sans-serif; background: #071624; color: white; padding: 1rem; border-radius: 8px; border: 1px solid rgba(35, 110, 178, 0.3);">
        <h3 style="margin: 0 0 8px 0; color: white; font-size: 16px;">${iconHtml}${area.name}</h3>
        <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Type: ${area.type}</p>
        <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Flood Risk: <span style="color: ${area.floodRisk === 'high' ? '#dc2626' : area.floodRisk === 'medium' ? '#f59e0b' : '#10b981'}; font-weight: 600;">${area.floodRisk}</span></p>
        ${area.population ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Population: ${area.population}</p>` : ''}
        ${area.notes ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Notes: ${area.notes}</p>` : ''}
      </div>
    `;
    polygon.bindPopup(popupContent);

    // Ensure area.coordinates exists and points to the polygon center (so focusOnArea still works)
    try {
      const center = polygon.getBounds().getCenter();
      area.coordinates = [center.lat, center.lng];
    } catch (err) {
      // ignore if polygon bounds fail
    }
  } else {
    // No polygon geometry => restore regular marker
    addMarkerToMap(area, iconSize);
  }
});


      // Set initial areas
      setMonitoredAreas(areasToLoad);
      
      setCurrentSimulation(null);

      // If we used sample data, save it to storage
      if (storedAreas.length === 0) {
        await saveAreasToStorage(sampleAreas);
      }

      // Handle draw events
      map.on(window.L.Draw.Event.CREATED, function (e: any) {
        const type = e.layerType;
        const layer = e.layer;

        if (type === 'marker') {
          const latlng = layer.getLatLng();
          setPendingMarkerLocation([latlng.lat, latlng.lng]);
          setPendingDrawnLayer(null); // Don't store the layer for markers
          showAreaModal();
        } else if (type === 'polygon' || type === 'rectangle') {
          // For polygons and rectangles, get center point and show modal
          const bounds = layer.getBounds();
          const center = bounds.getCenter();
          setPendingMarkerLocation([center.lat, center.lng]);
          setPendingDrawnLayer(layer);
          showAreaModal();
        }
      });

    };

    initMap();
  }, []);


  // Separate effect to manage map click handler
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing click handler if it exists
    if (mapClickHandlerRef.current) {
      mapInstanceRef.current.off('click', mapClickHandlerRef.current);
      mapClickHandlerRef.current = null;
    }

    // Add new click handler if in marker adding mode
    if (isAddingMarker) {
      const clickHandler = (e: any) => {
        console.log('Map clicked while in marker mode:', e.latlng);
        const latlng = e.latlng;
        setPendingMarkerLocation([latlng.lat, latlng.lng]);
        showAreaModal();
        setIsAddingMarker(false);
      };
      
      mapClickHandlerRef.current = clickHandler;
      mapInstanceRef.current.on('click', clickHandler);
      console.log('Map click handler added');
    }

    return () => {
      // Cleanup on unmount or when isAddingMarker changes
      if (mapInstanceRef.current && mapClickHandlerRef.current) {
        mapInstanceRef.current.off('click', mapClickHandlerRef.current);
        mapClickHandlerRef.current = null;
      }
    };
  }, [isAddingMarker]);

  // Show area modal
  const showAreaModal = () => {
    const modal = document.getElementById('areaModal');
    if (modal) {
      modal.classList.add('active');
      setIsModalOpen(true);

      // Trigger initial risk calculation
      setTimeout(() => {
        updateRiskCalculation();
      }, 100);
    }
  };

  // Hide area modal
  const hideAreaModal = () => {
    const modal = document.getElementById('areaModal');
    if (modal) {
      modal.classList.remove('active');
      setIsModalOpen(false);
    }
    setPendingMarkerLocation(null);
    setPendingDrawnLayer(null);
  };

// Save new area
const saveArea = async () => {
  // For markers, we still need a location
  if (!pendingMarkerLocation && !pendingDrawnLayer) return;

  const form = document.getElementById('areaForm') as HTMLFormElement;
  if (!form) return;

  const formData = new FormData(form);
  const areaName = (document.getElementById('areaName') as HTMLInputElement)?.value;
  const areaType = (document.getElementById('areaType') as HTMLSelectElement)?.value;
  const population = (document.getElementById('population') as HTMLInputElement)?.value;
  const notes = (document.getElementById('notes') as HTMLTextAreaElement)?.value;

  // Get flood risk - either calculated or manually overridden
  const overrideRiskCheckbox = document.getElementById('overrideRisk') as HTMLInputElement;
  const manualFloodRiskSelect = document.getElementById('floodRisk') as HTMLSelectElement;
  const manualFloodRisk = overrideRiskCheckbox?.checked ? manualFloodRiskSelect?.value : null;

  // If not overridden, calculate the risk
  let finalFloodRisk = manualFloodRisk;
  if (!finalFloodRisk) {
    const elevation = parseFloat((document.getElementById('elevation') as HTMLInputElement)?.value) || 5;
    const distanceFromWater = parseFloat((document.getElementById('distanceFromWater') as HTMLInputElement)?.value) || 50;
    const soilPermeability = (document.getElementById('soilPermeability') as HTMLSelectElement)?.value || 'medium';
    const slopeGradient = parseFloat((document.getElementById('slopeGradient') as HTMLInputElement)?.value) || 2;
    const drainageCondition = (document.getElementById('drainageCondition') as HTMLSelectElement)?.value || 'fair';
    const vegetationCover = (document.getElementById('vegetationCover') as HTMLSelectElement)?.value || 'medium';
    const floodHistory = (document.getElementById('floodHistory') as HTMLSelectElement)?.value || 'rare';

    const result = calculateFloodRisk(
      elevation,
      distanceFromWater,
      soilPermeability,
      slopeGradient,
      drainageCondition,
      vegetationCover,
      floodHistory,
      areaType
    );
    finalFloodRisk = result.level;
  }

  if (!areaName || !areaType || !finalFloodRisk) {
    alert('Please fill in all required fields');
    return;
  }

  const newArea: MonitoredArea = {
    id: Date.now().toString(),
    name: areaName,
    type: areaType,
    floodRisk: finalFloodRisk,
    coordinates: pendingMarkerLocation || [0, 0] // fallback, only used for markers
  };

  // Only add optional properties if they have values
  if (population) {
    newArea.population = parseInt(population);
  }
  if (notes) {
    newArea.notes = notes;
  }

  // If we have a drawn polygon/rectangle
  if (pendingDrawnLayer) {
    const riskColor =
      finalFloodRisk === 'high'
        ? '#dc2626'
        : finalFloodRisk === 'medium'
        ? '#f59e0b'
        : '#10b981';

    if (pendingDrawnLayer.setStyle) {
      pendingDrawnLayer.setStyle({
        fillColor: riskColor,
        color: riskColor,
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0.3
      });
    }

    drawnItemsRef.current.addLayer(pendingDrawnLayer);
    pendingDrawnLayer.areaData = newArea;
    const iconHtml = getAreaTypeIcon(newArea.type); 
    // Bind popup directly to the polygon
    const popupContent = `
      <div style="font-family: Inter, sans-serif; background: #071624; color: white; padding: 1rem; border-radius: 8px; border: 1px solid rgba(35, 110, 178, 0.3);">
        <h3 style="margin: 0 0 8px 0; color: white; font-size: 16px;">${iconHtml}${newArea.name}</h3>
        <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Type: ${newArea.type}</p>
        <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Flood Risk: <span style="color: ${newArea.floodRisk === 'high' ? '#dc2626' : newArea.floodRisk === 'medium' ? '#f59e0b' : '#10b981'}; font-weight: 600;">${newArea.floodRisk}</span></p>
        ${newArea.population ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Population: ${newArea.population}</p>` : ''}
        ${newArea.notes ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Notes: ${newArea.notes}</p>` : ''}
      </div>
    `;
    pendingDrawnLayer.bindPopup(popupContent);

    // Save polygon geometry for persistence
    if (pendingDrawnLayer.getLatLngs) {
      newArea.polygonData = pendingDrawnLayer.getLatLngs();
    }
  } else if (pendingMarkerLocation) {
    // Normal marker
    addMarkerToMap(newArea, iconSize);
  }

  // Update state
  const updatedAreas = [...monitoredAreas, newArea];
  setMonitoredAreas(updatedAreas);

  // Save to Firebase
  await saveAreasToStorage(updatedAreas);

  // Reset form and hide modal
  form.reset();

  // Reset risk calculation fields to defaults
  const overrideCheckbox = document.getElementById('overrideRisk') as HTMLInputElement;
  const floodRiskSelect = document.getElementById('floodRisk') as HTMLSelectElement;

  if (overrideCheckbox) overrideCheckbox.checked = false;
  if (floodRiskSelect) floodRiskSelect.disabled = true;

  // Reset risk display
  const riskLevelEl = document.getElementById('riskLevel');
  const riskScoreEl = document.getElementById('riskScore');
  const riskFactorsEl = document.getElementById('riskFactors');

  if (riskLevelEl) {
    riskLevelEl.textContent = 'Medium';
    riskLevelEl.className = 'risk-level';
  }
  if (riskScoreEl) riskScoreEl.textContent = 'Risk Score: 45/100';
  if (riskFactorsEl) riskFactorsEl.textContent = 'Calculating...';

  hideAreaModal();

  // Reset drawing states
  setIsAddingMarker(false);
  setIsDrawingPolygon(false);

  // Remove drawing cursor
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.classList.remove('drawing-mode');
  }

  updateButtonStates();
};
const deleteArea = async (areaId: string) => {
  // Remove from state
  const updatedAreas = monitoredAreas.filter(a => a.id !== areaId);
  setMonitoredAreas(updatedAreas);
  await saveAreasToStorage(updatedAreas);

  // Remove from map
  if (mapInstanceRef.current) {
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer.areaData && layer.areaData.id === areaId) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
  }
  if (drawnItemsRef.current) {
    drawnItemsRef.current.eachLayer((layer: any) => {
      if (layer.areaData && layer.areaData.id === areaId) {
        drawnItemsRef.current.removeLayer(layer);
      }
    });
  }

  // Update the list
  updateAreasList();
};


  // Weather simulation functions
  // Helper function to get weather condition name
  const getWeatherConditionName = React.useCallback((condition: string) => {
    const names: { [key: string]: string } = {
      'clear': 'Clear Weather',
      'light-rain': 'Light Rainfall',
      'heavy-rain': 'Heavy Rainfall',
      'thunderstorm': 'Thunderstorm',
      'typhoon': 'Typhoon'
    };
    return names[condition] || condition;
  }, []);

  // Helper function to get all markers and drawn items
  const getAllMarkersAndDrawnItems = React.useCallback(() => {
    const allItems: Array<{marker?: any, layer?: any}> = [];
    
    // Find all layers with area data on the main map
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer.areaData) {
        allItems.push({ marker: layer });
      }
    });
    // Find all drawn items with area data
    if (drawnItemsRef.current) {
      drawnItemsRef.current.eachLayer((layer: any) => {
        if (layer.areaData) {
          allItems.push({ layer: layer });
        }
        
        // Also check if the drawn item has an associated marker
        if (layer.associatedMarker && layer.associatedMarker.areaData) {
          allItems.push({ marker: layer.associatedMarker });
        }
      });
    }
    
    return allItems;
  }, []);

  const processItemSimulation = React.useCallback((item: any, condition: string) => {
    try {
      const area = item.marker ? item.marker.areaData : item.layer.areaData;
      if (!area) return;
      
      let simulatedFloodRisk = area.floodRisk;
      
      // Adjust risk levels based on weather condition
      switch (condition) {
        case 'clear':
          // When weather is clear, all risks should be low regardless of base risk
          simulatedFloodRisk = 'low';
          break;

        case 'light-rain':
          // Increase flood risk by one level for flood-prone areas
          if (area.floodRisk === 'low') simulatedFloodRisk = 'medium';
          else if (area.floodRisk === 'medium') simulatedFloodRisk = 'high';
          else if (area.floodRisk === 'high') simulatedFloodRisk = 'high';
          break;

        case 'heavy-rain':
          // Significantly increase flood risk
          if (area.floodRisk === 'low') simulatedFloodRisk = 'high';
          else if (area.floodRisk === 'medium') simulatedFloodRisk = 'high';
          else if (area.floodRisk === 'high') simulatedFloodRisk = 'high';
          break;

        case 'thunderstorm':
          // High risk for flood
          simulatedFloodRisk = 'high';
          break;

        case 'typhoon':
          // Extreme risk - flood becomes high risk
          simulatedFloodRisk = 'high';
          break;
      }
      
      // Store simulated risks in the area data for the monitored areas list
      area.simulatedFloodRisk = simulatedFloodRisk;
      area.isSimulated = true;

      // Calculate new color based on flood risk
      const newColor = simulatedFloodRisk === 'high' ? '#dc2626' :
                      simulatedFloodRisk === 'medium' ? '#f59e0b' : '#10b981';

      const isHighRisk = simulatedFloodRisk === 'high';
      
      // Update marker icon color
      if (item.marker && item.marker.setIcon) {
        const size = item.marker.iconSize || iconSize;
        const iconHtml = `
          <div class="custom-marker-icon ${isHighRisk ? 'high-risk-glow' : ''}" style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${newColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size * 0.4}px;
            color: white;
            font-weight: bold;
          ">
            ${getAreaTypeIcon(area.type)}
          </div>
        `;
        
        const newIcon = window.L.divIcon({
          className: 'custom-marker-icon',
          html: iconHtml,
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
          popupAnchor: [0, -size]
        });
        item.marker.setIcon(newIcon);
      }
      
      if (item.layer && item.layer.setStyle) {
        item.layer.setStyle({
          fillColor: newColor,
          color: newColor,
          weight: 3,
          opacity: 0.8,
          fillOpacity: 0.3
        });
        
        // Add or remove high-risk glow class for polygons
        const layerElement = item.layer.getElement();
        if (layerElement) {
          if (isHighRisk) {
            layerElement.classList.add('high-risk-polygon');
          } else {
            layerElement.classList.remove('high-risk-polygon');
          }
        }
      }
      
      // Update popup content with simulated risks
      const popupContent = `
        <div style="font-family: Inter, sans-serif; background: #071624; color: white; padding: 1rem; border-radius: 8px; border: 1px solid rgba(35, 110, 178, 0.3);">
          <h3 style="margin: 0 0 8px 0; color: white; font-size: 16px;">${area.name}</h3>
          <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Type: ${area.type}</p>
          <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">
            Simulated Flood Risk: <span style="color: ${simulatedFloodRisk === 'high' ? '#dc2626' : simulatedFloodRisk === 'medium' ? '#f59e0b' : '#10b981'}; font-weight: 600;">${simulatedFloodRisk}</span>
            ${simulatedFloodRisk !== area.floodRisk ? ` (was ${area.floodRisk})` : ''}
          </p>
          ${area.population ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Population: ${area.population}</p>` : ''}
          ${area.notes ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Notes: ${area.notes}</p>` : ''}
          <p style="margin: 8px 0 0 0; color: #3b82f6; font-size: 12px; font-style: italic;">🌦️ Simulated conditions: ${getWeatherConditionName(condition)}</p>
        </div>
      `;
      
      // Update popup content
      if (item.marker && item.marker.setPopupContent) {
        if (item.marker.setPopupContent) {
          item.marker.setPopupContent(popupContent);
        } else if (item.marker.getPopup()) {
          item.marker.getPopup().setContent(popupContent);
        }
      }
      
      if (item.layer && item.layer.setPopupContent) {
        if (item.layer.setPopupContent) {
          item.layer.setPopupContent(popupContent);
        } else if (item.layer.getPopup()) {
          item.layer.getPopup().setContent(popupContent);
        }
      }
    } catch (error) {
      console.error('Error processing item simulation:', error);
    }
  }, [getWeatherConditionName]);
  
  const processItemReset = React.useCallback((item: any) => {
    try {
      const area = item.marker ? item.marker.areaData : item.layer.areaData;
      if (!area) return;
      
      // Reset simulated risks
      area.simulatedFloodRisk = undefined;
      area.isSimulated = false;
      
      // Calculate original color based on original risk levels
      const originalColor = area.floodRisk === 'high' || area.landslideRisk === 'high' ? '#dc2626' :
                           area.floodRisk === 'medium' || area.landslideRisk === 'medium' ? '#f59e0b' : '#10b981';
      
      // Reset marker icon color
      if (item.marker && item.marker.setIcon) {
        const size = item.marker.iconSize || iconSize;
        const iconHtml = `
          <div class="custom-marker-icon" style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${originalColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size * 0.4}px;
            color: white;
            font-weight: bold;
          ">
            ${getAreaTypeIcon(area.type)}
          </div>
        `;
        
        const resetIcon = window.L.divIcon({
          className: 'custom-marker-icon',
          html: iconHtml,
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
          popupAnchor: [0, -size]
        });
        item.marker.setIcon(resetIcon);
      }
      
      if (item.layer && item.layer.setStyle) {
        item.layer.setStyle({
          fillColor: originalColor,
          color: originalColor,
          weight: 3,
          opacity: 0.8,
          fillOpacity: 0.3
        });
        
        // Remove high-risk glow class from polygons
        const layerElement = item.layer.getElement();
        if (layerElement) {
          layerElement.classList.remove('high-risk-polygon');
        }
      }
      
      // Reset popup content to original state
      const popupContent = `
        <div style="font-family: Inter, sans-serif; background: #071624; color: white; padding: 1rem; border-radius: 8px; border: 1px solid rgba(35, 110, 178, 0.3);">
          <h3 style="margin: 0 0 8px 0; color: white; font-size: 16px;">${area.name}</h3>
          <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Type: ${area.type}</p>
          <p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Flood Risk: <span style="color: ${area.floodRisk === 'high' ? '#dc2626' : area.floodRisk === 'medium' ? '#f59e0b' : '#10b981'}; font-weight: 600;">${area.floodRisk}</span></p>
          ${area.population ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Population: ${area.population}</p>` : ''}
          ${area.notes ? `<p style="margin: 4px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Notes: ${area.notes}</p>` : ''}
        </div>
      `;
      
      // Update popup content
      if (item.marker && item.marker.setPopupContent) {
        if (item.marker.setPopupContent) {
          item.marker.setPopupContent(popupContent);
        } else if (item.marker.getPopup()) {
          item.marker.getPopup().setContent(popupContent);
        }
      }
      
      if (item.layer && item.layer.setPopupContent) {
        if (item.layer.setPopupContent) {
          item.layer.setPopupContent(popupContent);
        } else if (item.layer.getPopup()) {
          item.layer.getPopup().setContent(popupContent);
        }
      }
    } catch (error) {
      console.error('Error processing item reset:', error);
    }
  }, []);
  
  // Update areas list
  const updateAreasList = React.useCallback(() => {
  const areasList = document.getElementById('areasList');
  if (!areasList) return;

  areasList.innerHTML = monitoredAreas.map(area => {
    const isPolygon = !!area.polygonData;

    return `
      <div class="area-item" id="area-${area.id}">
        <div class="area-header">
          <div class="area-title" onclick="focusOnArea('${area.id}')">
            <span class="area-icon">${isPolygon ? '🔹' : '📍'}</span>
            <span class="area-name">${area.name}</span>
          </div>
          <button class="delete-area-btn" data-id="${area.id}">✖</button>
        </div>

        ${area.isSimulated
          ? `<div class="area-simulated">🌦️ Simulated conditions</div>`
          : ''}

        <div class="area-details" onclick="focusOnArea('${area.id}')">
          <div class="risk-row">
            <span>Flood: <span class="risk-badge risk-${area.simulatedFloodRisk || area.floodRisk}">
              ${area.simulatedFloodRisk || area.floodRisk}
            </span>
            ${area.simulatedFloodRisk && area.simulatedFloodRisk !== area.floodRisk
              ? `<span class="was-risk">(was ${area.floodRisk})</span>` : ''}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  areasList.querySelectorAll('.delete-area-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const id = target.getAttribute('data-id');
    if (id) {
      const area = monitoredAreas.find(a => a.id === id);
      const name = area ? area.name : "this area";

      // Update modal message
      const message = document.getElementById('deleteConfirmMessage');
      if (message) message.textContent = `Are you sure you want to delete "${name}"?`;

      // Store ID to delete
      (document.getElementById('deleteConfirmBtn') as HTMLElement).setAttribute('data-id', id);

      // Show modal
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.classList.add('active');
    }
    e.stopPropagation();
  });
});

}, [monitoredAreas]);


  // Force update areas list when simulation state changes
  const forceUpdateAreasList = React.useCallback(() => {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      updateAreasList();
    }, 50);
  }, [updateAreasList]);

  const updateSimulationButtonStates = React.useCallback((activeCondition: string | null) => {
    // Implementation for updating simulation button states
  }, []);

  const simulateWeatherCondition = React.useCallback((condition: string) => {
    console.log('Simulating weather condition:', condition);
    if (!mapInstanceRef.current) return;

    setCurrentSimulation(condition);

    // Get all markers and drawn items
    const allItems = getAllMarkersAndDrawnItems();

    // Process all items immediately for better responsiveness
    allItems.forEach(item => {
      processItemSimulation(item, condition);
    });

    // Update button states immediately
    updateSimulationButtonStates(condition);

    // Force update the areas list after simulation
    forceUpdateAreasList();

    // Generate notifications for high-risk areas - use the same approach as real-time simulation
    // This ensures consistency between manual and automatic simulation notifications
    if (weatherData && forecast.length > 0) {
      // Small delay to ensure all state updates are complete
      setTimeout(async () => {
        await generateNotifications(weatherData, forecast);
      }, 50);
    }
  }, [getAllMarkersAndDrawnItems, processItemSimulation, updateSimulationButtonStates, forceUpdateAreasList, weatherData, forecast]);
  
  const resetSimulation = React.useCallback(async () => {
    console.log('Resetting simulation');
    if (!mapInstanceRef.current) return;

    setCurrentSimulation(null);

    // Get all markers and drawn items
    const allItems = getAllMarkersAndDrawnItems();

    // Process all items immediately
    allItems.forEach(item => {
      processItemReset(item);
    });

    // Update button states immediately
    updateSimulationButtonStates(null);

    // Force update the areas list after reset
    forceUpdateAreasList();

    // Regenerate notifications to clear simulation-based alerts
    if (weatherData && forecast.length > 0) {
      await generateNotifications(weatherData, forecast);
    }

    // If real-time simulation is enabled, immediately apply current weather conditions
    if (realTimeSimulationEnabled && weatherData && forecast.length > 0) {
      setTimeout(() => runRealTimeSimulation(), 100);
    }
  }, [getAllMarkersAndDrawnItems, processItemReset, updateSimulationButtonStates, forceUpdateAreasList, realTimeSimulationEnabled, weatherData, forecast]);

  // Real-time simulation based on actual weather data
  const runRealTimeSimulation = React.useCallback(() => {
    if (!realTimeSimulationEnabled || !weatherData || !forecast.length) return;

    // Analyze current weather and forecast to determine condition
    const currentCondition = determineWeatherCondition(weatherData, forecast);

    if (currentCondition && currentCondition !== currentSimulation) {
      console.log('Running real-time simulation with condition:', currentCondition);

      // Apply the same simulation logic as manual simulation
      setCurrentSimulation(currentCondition);

      // Get all markers and drawn items
      const allItems = getAllMarkersAndDrawnItems();

      // Process all items with the determined condition
      allItems.forEach(item => {
        processItemSimulation(item, currentCondition);
      });

      // Force update the areas list
      forceUpdateAreasList();
    }
  }, [realTimeSimulationEnabled, weatherData, forecast, currentSimulation, getAllMarkersAndDrawnItems, processItemSimulation, forceUpdateAreasList]);

  // Determine weather condition from real data
  const determineWeatherCondition = React.useCallback((currentWeather: WeatherData, forecastData: ForecastDay[]): string | null => {
    // Check current weather conditions
    const currentPrecipitation = currentWeather.precipitation;
    const currentWindSpeed = currentWeather.windSpeed;
    const weatherDescription = currentWeather.description.toLowerCase();

    // Check forecast for upcoming severe conditions (conservative thresholds)
    const severeForecast = forecastData.slice(0, 2).some(day =>
      day.precipitation > 20 || day.windSpeed > 25
    );

    // Determine condition based on weather data with reasonable thresholds
    if (severeForecast) {
      return 'typhoon'; // Extreme conditions in forecast
    } else if (currentPrecipitation > 15 || currentWindSpeed > 20) {
      return 'typhoon'; // Current extreme conditions
    } else if (currentPrecipitation > 8 || currentWindSpeed > 12) {
      return 'thunderstorm'; // High risk conditions
    } else if (currentPrecipitation > 4 || currentWindSpeed > 8) {
      return 'heavy-rain'; // Moderate to heavy rain
    } else if (currentPrecipitation > 0.5 || weatherDescription.includes('rain') || weatherDescription.includes('drizzle') || weatherDescription.includes('shower')) {
      return 'light-rain'; // Light rain or any rain description
    } else {
      return 'clear'; // Clear or minimal precipitation - all risks should be low
    }
  }, []);

  // Function to update all marker sizes
  const updateAllMarkerSizes = React.useCallback((newSize: number) => {
  if (!mapInstanceRef.current) return;

  mapInstanceRef.current.eachLayer((layer: any) => {
    if (layer.areaData && layer.setIcon) {
      const area = layer.areaData;

      // Determine color based on current state (simulated or original)
      const floodRisk = area.simulatedFloodRisk || area.floodRisk;
      const landslideRisk = area.simulatedLandslideRisk || area.landslideRisk;
      const color =
        floodRisk === 'high' || landslideRisk === 'high'
          ? '#dc2626'
          : floodRisk === 'medium' || landslideRisk === 'medium'
          ? '#f59e0b'
          : '#10b981';

      const isHighRisk = floodRisk === 'high' || landslideRisk === 'high';

      // Use the correct area type icon (instead of 📍)
      const iconHtml = `
        <div class="custom-marker-icon ${isHighRisk && area.isSimulated ? 'high-risk-glow' : ''}" 
             style="
              width: ${newSize}px;
              height: ${newSize}px;
              background-color: ${color};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${newSize * 0.4}px;
              color: white;
              font-weight: bold;
            ">
          ${getAreaTypeIcon(area.type)}
        </div>
      `;

      const newIcon = window.L.divIcon({
        className: 'custom-marker-icon',
        html: iconHtml,
        iconSize: [newSize, newSize],
        iconAnchor: [newSize / 2, newSize],
        popupAnchor: [0, -newSize],
      });

      layer.setIcon(newIcon);
      layer.iconSize = newSize; // Update stored size
    }
  });
}, []);


  // Handle icon size change
  const handleIconSizeChange = (newSize: number) => {
    setIconSize(newSize);
    updateAllMarkerSizes(newSize);
  };

  const toggleSimulationPanel = () => {
    const panel = document.querySelector('.simulation-panel');
    const toggle = document.getElementById('simulationToggle');
    
    if (panel && toggle) {
      panel.classList.toggle('collapsed');
      const isCollapsed = panel.classList.contains('collapsed');
      toggle.textContent = isCollapsed ? '+' : '−';
    }
  };

  // Update button states
  const updateButtonStates = () => {
    const addMarkerBtn = document.getElementById('addMarkerBtn');
    const drawPolygonBtn = document.getElementById('drawPolygonBtn');
    const mapContainer = document.getElementById('map');

    if (addMarkerBtn) {
      if (isAddingMarker) {
        addMarkerBtn.classList.add('active');
        addMarkerBtn.textContent = '📍 Click Map to Add';
      } else {
        addMarkerBtn.classList.remove('active');
        addMarkerBtn.textContent = '📍 Add Marker';
      }
    }

   if (drawPolygonBtn) {
  if (isDrawingPolygon) {
    drawPolygonBtn.classList.add('active');
    drawPolygonBtn.textContent = '🔹 Drawing Mode';
    mapContainer?.classList.add('show-draw-controls');   // ✅ force add
  } else {
    drawPolygonBtn.classList.remove('active');
    drawPolygonBtn.textContent = '🔹 Draw Area';
    mapContainer?.classList.remove('show-draw-controls'); // ✅ force remove
  }
}


  };

  // Handle notification action buttons (Confirm/Disregard)
  const handleNotificationAction = async (e: Event) => {
    const button = e.target as HTMLElement;
    const action = button.getAttribute('data-action');
    const areaId = button.getAttribute('data-area-id');
    const indexAttr = button.getAttribute('data-index');
    if (!action) return;
 
    // Handle high-risk alert actions (bulk operations)
    if (action === 'confirm-high-risk' || action === 'disregard-high-risk') {
      if (!indexAttr) return;
      const idx = parseInt(indexAttr, 10);
      if (Number.isNaN(idx)) return;
 
      const notifications = await firebaseService.loadNotifications();
      const notification = notifications[idx];

      if (notification && notification.highRiskAreas) {
        // Process all high-risk areas (await each write to ensure completion/order)
        for (const area of notification.highRiskAreas) {
          if (action === 'confirm-high-risk') {
            // Record that flooding occurred
            const floodRecord = {
              areaId: area.id,
              areaName: area.name,
              confirmedBy: 'user',
              weatherConditions: weatherData,
              simulationContext: currentSimulation || 'real-time'
            };
            try {
              await firebaseService.saveFloodRecord(floodRecord);
              console.log('Flood record saved to Firebase');
            } catch (error) {
              console.error('Error saving flood record to Firebase (bulk):', error);
            }
          } else if (action === 'disregard-high-risk') {
            // Record that flooding was disregarded
            const disregardRecord = {
              areaId: area.id,
              areaName: area.name,
              disregardedBy: 'user',
              weatherConditions: weatherData,
              simulationContext: currentSimulation || 'real-time'
            };
            try {
              await firebaseService.saveDisregardRecord(disregardRecord);
              console.log('Disregard record saved to Firebase');
            } catch (error) {
              console.error('Error saving disregard record to Firebase (bulk):', error);
            }
          }
        }

        // Show success message
        const actionText = action === 'confirm-high-risk' ? 'confirmed' : 'disregarded';
        const bulkSuccessMessage = document.createElement('div');
        bulkSuccessMessage.className = 'success-message';
        bulkSuccessMessage.textContent = `Flood ${actionText} for all high-risk areas`;
        bulkSuccessMessage.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          font-weight: 500;
          animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(bulkSuccessMessage);
        setTimeout(() => {
          if (bulkSuccessMessage.parentNode) {
            bulkSuccessMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
              if (bulkSuccessMessage.parentNode) {
                bulkSuccessMessage.parentNode.removeChild(bulkSuccessMessage);
              }
            }, 300);
          }
        }, 3000);

        // Remove this notification
        const notificationItem = button.closest('.notification-item') as HTMLElement;
        if (notificationItem) {
          notificationItem.remove();

          // Update badge count
          const notificationBadge = document.getElementById('notificationBadge');
          const currentCount = parseInt(notificationBadge?.textContent || '0') - 1;
          if (notificationBadge) {
            if (currentCount > 0) {
              notificationBadge.textContent = currentCount.toString();
            } else {
              notificationBadge.style.display = 'none';
            }
          }
        }

        // Refresh historical data if the historical modal is currently open
        const historicalModal = document.getElementById('historicalModal');
        if (historicalModal && historicalModal.classList.contains('active')) {
          // Define showDetailedFloodRecords function locally
          const showDetailedFloodRecordsLocal = (date: string, records: any[]) => {
            const detailedRecordsModal = document.getElementById('detailedRecordsModal');
            const detailedRecordsTitle = document.getElementById('detailedRecordsTitle');
            const detailedRecordsList = document.getElementById('detailedRecordsList');

            if (!detailedRecordsModal || !detailedRecordsTitle || !detailedRecordsList) return;

            // Update modal title
            detailedRecordsTitle.textContent = `Flood Records for ${date}`;

            // Create HTML for detailed records
            const html = records.map(record => {
              const isConfirmed = !record.disregardedBy;
              const actionText = isConfirmed ? 'Confirmed' : 'Disregarded';
              const actionColor = isConfirmed ? '#10b981' : '#f59e0b';

              return `
                <div class="detailed-record-item" style="
                  background: rgba(59, 130, 246, 0.05);
                  border: 1px solid rgba(59, 130, 246, 0.2);
                  border-radius: 8px;
                  padding: 1rem;
                  margin-bottom: 0.75rem;
                ">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: white;">${record.areaName}</div>
                    <div style="
                      background: ${actionColor};
                      color: white;
                      padding: 4px 8px;
                      border-radius: 4px;
                      font-size: 0.75rem;
                      font-weight: 600;
                    ">${actionText}</div>
                  </div>
                  <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.875rem; margin-bottom: 0.5rem;">
                    Type: ${record.areaName ? 'Area' : 'Unknown'} • ID: ${record.areaId}
                  </div>
                  <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">
                    ${new Date(record.timestamp).toLocaleTimeString()} • Context: ${record.simulationContext || 'Real-time'}
                  </div>
                  ${record.weatherConditions ? `
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(59, 130, 246, 0.2);">
                      <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.75rem;">
                        Weather: ${record.weatherConditions.temperature}°C, ${record.weatherConditions.description}
                        ${record.weatherConditions.precipitation > 0 ? `, ${record.weatherConditions.precipitation}mm rain` : ''}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('');

            detailedRecordsList.innerHTML = html;

            // Show the modal
            detailedRecordsModal.classList.add('active');
            detailedRecordsModal.style.display = 'flex';
            detailedRecordsModal.style.position = 'fixed';
            detailedRecordsModal.style.top = '0';
            detailedRecordsModal.style.left = '0';
            detailedRecordsModal.style.width = '100%';
            detailedRecordsModal.style.height = '100%';
            detailedRecordsModal.style.background = 'rgba(7, 22, 36, 0.8)';
            detailedRecordsModal.style.backdropFilter = 'blur(8px)';
            detailedRecordsModal.style.zIndex = '10000';
            detailedRecordsModal.style.alignItems = 'center';
            detailedRecordsModal.style.justifyContent = 'center';
          };

          // Load and display updated flood records
          const loadHistoricalFloodData = async () => {
            const historicalDataGrid = document.getElementById('historicalDataGrid');
            if (!historicalDataGrid) return;

            // Load flood records from Firebase
            const floodRecords = await loadFloodRecords();
            const disregardRecords = await loadDisregardRecords();

            // Combine and group by date
            const allRecords = [...floodRecords, ...disregardRecords];
            const recordsByDate: { [key: string]: any[] } = {};

            allRecords.forEach(record => {
              const date = new Date(record.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });

              if (!recordsByDate[date]) {
                recordsByDate[date] = [];
              }
              recordsByDate[date].push(record);
            });

            // Sort dates in descending order (most recent first)
            const sortedDates = Object.keys(recordsByDate).sort((a, b) =>
              new Date(b).getTime() - new Date(a).getTime()
            );

            if (sortedDates.length === 0) {
              historicalDataGrid.innerHTML = `
                <div class="no-historical-data">
                  <div class="no-data-icon">📊</div>
                  <div class="no-data-text">No flood records found</div>
                  <div class="no-data-subtext">Flood confirmations will appear here when recorded</div>
                </div>
              `;
              return;
            }

            // Create HTML for each date group
            const html = sortedDates.map(date => {
              const records = recordsByDate[date];
              const confirmedCount = records.filter(r => !r.disregardedBy).length;
              const disregardedCount = records.filter(r => r.disregardedBy).length;

              return `
                <div class="historical-item" data-date="${date}" style="cursor: pointer;">
                  <div class="historical-date">${date}</div>
                  <div class="historical-event">
                    ${confirmedCount} confirmed flood${confirmedCount !== 1 ? 's' : ''}${disregardedCount > 0 ? `, ${disregardedCount} disregarded` : ''}
                  </div>
                  <div class="historical-details">
                    Click to view detailed flood records for this date
                  </div>
                </div>
              `;
            }).join('');

            historicalDataGrid.innerHTML = html;

            // Add click event listeners to date items
            historicalDataGrid.querySelectorAll('.historical-item').forEach(item => {
              item.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const date = target.getAttribute('data-date');
                if (date) {
                  // Open detailed records page in new tab
                  const records = recordsByDate[date] || [];
                  const recordsParam = encodeURIComponent(JSON.stringify(records));
                  const url = `detailed-records.html?date=${encodeURIComponent(date)}&records=${recordsParam}`;
                  window.open(url, '_blank');
                }
              });
            });
          };

          await loadHistoricalFloodData();
        }
      }
      return;
    }

    // Handle review action for high-risk alerts
    if (action === 'review-high-risk') {
      if (!indexAttr) return;
      const idx = parseInt(indexAttr, 10);
      if (Number.isNaN(idx)) return;
 
      const notifications = await firebaseService.loadNotifications();
      const notification = notifications[idx];

      if (notification && notification.highRiskAreas) {
        showHighRiskModal(notification.highRiskAreas, notification.isSimulation);
      }
      return;
    }

    // Handle individual area actions
    if (!areaId) return;

    // Find the area
    const area = monitoredAreas.find(a => a.id === areaId);
    if (!area) return;

    // Store action details for the modal
    (window as any).pendingFloodAction = { action, areaId, area };

    // Show flood confirmation modal
    const floodModal = document.getElementById('floodConfirmModal');
    const floodMessage = document.getElementById('floodConfirmMessage');
    const floodConfirmBtn = document.getElementById('floodConfirmBtn');

    if (floodModal && floodMessage && floodConfirmBtn) {
      const actionText = action === 'confirm' ? 'confirm flooding occurred' : 'disregard this flood alert';
      floodMessage.textContent = `Are you sure you want to ${actionText} for "${area.name}"?`;
      floodConfirmBtn.textContent = action === 'confirm' ? 'Confirm Flood' : 'Disregard';

      floodModal.classList.add('active');
    }
  };

  // Handle flood confirmation modal actions
  const handleFloodConfirmation = async (confirmed: boolean) => {
    console.log('handleFloodConfirmation called:', { confirmed, pending: (window as any).pendingFloodAction });
    const pendingAction = (window as any).pendingFloodAction;
    if (!pendingAction) return;

    const { action, areaId, area } = pendingAction;

    if (confirmed) {
      if (action === 'confirm') {
        // Record that flooding occurred in this area
        console.log(`Flooding confirmed in area: ${area.name} (${areaId})`);

        // Store this information in Firebase
        console.log('Saving flood record to Firebase...');
        const floodRecord = {
          areaId: area.id,
          areaName: area.name,
          confirmedBy: 'user',
          weatherConditions: weatherData,
          simulationContext: currentSimulation || 'real-time'
        };
        try {
          await firebaseService.saveFloodRecord(floodRecord);
          console.log('Flood record saved to Firebase');
        } catch (error) {
          console.error('Error saving flood record to Firebase:', error);
        }

        // Show success notification
        const confirmSuccessMessage = document.createElement('div');
        confirmSuccessMessage.className = 'success-message';
        confirmSuccessMessage.textContent = `✅ Flood record saved for ${area.name}`;
        confirmSuccessMessage.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          font-weight: 500;
          animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(confirmSuccessMessage);
        setTimeout(() => {
          if (confirmSuccessMessage.parentNode) {
            confirmSuccessMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
              if (confirmSuccessMessage.parentNode) {
                confirmSuccessMessage.parentNode.removeChild(confirmSuccessMessage);
              }
            }, 300);
          }
        }, 3000);

        // Show success notification (single instance)
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = `✅ Flood record saved for ${area.name}`;
        successMessage.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          font-weight: 500;
          animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(successMessage);
        setTimeout(() => {
          if (successMessage.parentNode) {
            successMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
              if (successMessage.parentNode) {
                successMessage.parentNode.removeChild(successMessage);
              }
            }, 300);
          }
        }, 3000);

        // Show success notification
        const individualConfirmMessage = document.createElement('div');
        individualConfirmMessage.className = 'success-message';
        individualConfirmMessage.textContent = `✅ Flood record saved for ${area.name}`;
        individualConfirmMessage.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          font-weight: 500;
          animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(individualConfirmMessage);
        setTimeout(() => {
          if (individualConfirmMessage.parentNode) {
            individualConfirmMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
              if (individualConfirmMessage.parentNode) {
                individualConfirmMessage.parentNode.removeChild(individualConfirmMessage);
              }
            }, 300);
          }
        }, 3000);

      } else if (action === 'disregard') {
        // Record that flooding was disregarded
        console.log(`Flooding disregarded for area: ${area.name} (${areaId})`);

        console.log('Saving disregard record to Firebase...');
        const disregardRecord = {
          areaId: area.id,
          areaName: area.name,
          disregardedBy: 'user',
          weatherConditions: weatherData,
          simulationContext: currentSimulation || 'real-time'
        };
        firebaseService.saveDisregardRecord(disregardRecord).then(() => {
          console.log('Disregard record saved to Firebase');
        }).catch(error => {
          console.error('Error saving disregard record to Firebase:', error);
        });

        // Show success notification
        const individualDisregardMessage = document.createElement('div');
        individualDisregardMessage.className = 'success-message';
        individualDisregardMessage.textContent = `⚠️ Flood alert disregarded for ${area.name}`;
        individualDisregardMessage.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f59e0b;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          font-weight: 500;
          animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(individualDisregardMessage);
        setTimeout(() => {
          if (individualDisregardMessage.parentNode) {
            individualDisregardMessage.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
              if (individualDisregardMessage.parentNode) {
                individualDisregardMessage.parentNode.removeChild(individualDisregardMessage);
              }
            }, 300);
          }
        }, 3000);
      }
    }

    // Show success message
    const actionText = confirmed ? (action === 'confirm' ? 'confirmed' : 'disregarded') : 'cancelled';
    const areaName = area.name;

    // Create a temporary success message
    const floodActionMessage = document.createElement('div');
    floodActionMessage.className = 'success-message';
    floodActionMessage.textContent = `Flood ${actionText} for ${areaName}`;
    floodActionMessage.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(floodActionMessage);

    // Remove success message after 3 seconds
    setTimeout(() => {
      if (floodActionMessage.parentNode) {
        floodActionMessage.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (floodActionMessage.parentNode) {
            floodActionMessage.parentNode.removeChild(floodActionMessage);
          }
        }, 300);
      }
    }, 3000);

    // Hide modal
    const floodModal = document.getElementById('floodConfirmModal');
    if (floodModal) {
      floodModal.classList.remove('active');
    }

    // Clear pending action
    (window as any).pendingFloodAction = null;

    // Remove this notification from the list
    const notificationItem = document.querySelector(`[data-area-id="${areaId}"]`) as HTMLElement;
    if (notificationItem) {
      notificationItem.remove();

      // Update badge count
      const notificationBadge = document.getElementById('notificationBadge');
      const currentCount = parseInt(notificationBadge?.textContent || '0') - 1;
      if (notificationBadge) {
        if (currentCount > 0) {
          notificationBadge.textContent = currentCount.toString();
        } else {
          notificationBadge.style.display = 'none';
        }
      }
    }

    // Refresh historical data if the historical modal is currently open
    const historicalModal = document.getElementById('historicalModal');
    if (historicalModal && historicalModal.classList.contains('active')) {
      // Define showDetailedFloodRecords function locally
      const showDetailedFloodRecordsLocal = (date: string, records: any[]) => {
        const detailedRecordsModal = document.getElementById('detailedRecordsModal');
        const detailedRecordsTitle = document.getElementById('detailedRecordsTitle');
        const detailedRecordsList = document.getElementById('detailedRecordsList');

        if (!detailedRecordsModal || !detailedRecordsTitle || !detailedRecordsList) return;

        // Update modal title
        detailedRecordsTitle.textContent = `Flood Records for ${date}`;

        // Create HTML for detailed records
        const html = records.map(record => {
          const isConfirmed = !record.disregardedBy;
          const actionText = isConfirmed ? 'Confirmed' : 'Disregarded';
          const actionColor = isConfirmed ? '#10b981' : '#f59e0b';

          return `
            <div class="detailed-record-item" style="
              background: rgba(59, 130, 246, 0.05);
              border: 1px solid rgba(59, 130, 246, 0.2);
              border-radius: 8px;
              padding: 1rem;
              margin-bottom: 0.75rem;
            ">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: white;">${record.areaName}</div>
                <div style="
                  background: ${actionColor};
                  color: white;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 0.75rem;
                  font-weight: 600;
                ">${actionText}</div>
              </div>
              <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.875rem; margin-bottom: 0.5rem;">
                Type: ${record.areaName ? 'Area' : 'Unknown'} • ID: ${record.areaId}
              </div>
              <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">
                ${new Date(record.timestamp).toLocaleTimeString()} • Context: ${record.simulationContext || 'Real-time'}
              </div>
              ${record.weatherConditions ? `
                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(59, 130, 246, 0.2);">
                  <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.75rem;">
                    Weather: ${record.weatherConditions.temperature}°C, ${record.weatherConditions.description}
                    ${record.weatherConditions.precipitation > 0 ? `, ${record.weatherConditions.precipitation}mm rain` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        detailedRecordsList.innerHTML = html;

        // Show the modal (force to front and visible)
        if (detailedRecordsModal.parentElement !== document.body) {
          document.body.appendChild(detailedRecordsModal);
        }
        detailedRecordsModal.classList.add('active');
        detailedRecordsModal.style.display = 'flex';
        detailedRecordsModal.style.position = 'fixed';
        detailedRecordsModal.style.top = '0';
        detailedRecordsModal.style.left = '0';
        detailedRecordsModal.style.width = '100%';
        detailedRecordsModal.style.height = '100%';
        detailedRecordsModal.style.background = 'rgba(7, 22, 36, 0.8)';
        detailedRecordsModal.style.backdropFilter = 'blur(8px)';
        detailedRecordsModal.style.zIndex = '2147483647';
        detailedRecordsModal.style.alignItems = 'center';
        detailedRecordsModal.style.justifyContent = 'center';
        detailedRecordsModal.style.pointerEvents = 'auto';
        detailedRecordsModal.style.visibility = 'visible';
        detailedRecordsModal.style.opacity = '1';

        const modalContentA = detailedRecordsModal.querySelector('.detailed-records-modal-content') as HTMLElement | null;
        if (modalContentA) {
          modalContentA.style.display = 'block';
          modalContentA.style.opacity = '1';
          modalContentA.style.visibility = 'visible';
          modalContentA.style.zIndex = '2147483647';
          modalContentA.style.background = '#071624';
          modalContentA.style.border = '1px solid rgba(35, 110, 178, 0.3)';
          modalContentA.style.transform = 'none';
          modalContentA.style.margin = '0 auto';
        }
      };

      // Load and display updated flood records
      const loadHistoricalFloodData = async () => {
        const historicalDataGrid = document.getElementById('historicalDataGrid');
        if (!historicalDataGrid) return;

        // Load flood records from Firebase
        const floodRecords = await loadFloodRecords();
        const disregardRecords = await loadDisregardRecords();

        // Combine and group by date
        const allRecords = [...floodRecords, ...disregardRecords];
        const recordsByDate: { [key: string]: any[] } = {};

        allRecords.forEach(record => {
          const date = new Date(record.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          if (!recordsByDate[date]) {
            recordsByDate[date] = [];
          }
          recordsByDate[date].push(record);
        });

        // Sort dates in descending order (most recent first)
        const sortedDates = Object.keys(recordsByDate).sort((a, b) =>
          new Date(b).getTime() - new Date(a).getTime()
        );

        if (sortedDates.length === 0) {
          historicalDataGrid.innerHTML = `
            <div class="no-historical-data">
              <div class="no-data-icon">📊</div>
              <div class="no-data-text">No flood records found</div>
              <div class="no-data-subtext">Flood confirmations will appear here when recorded</div>
            </div>
          `;
          return;
        }

        // Create HTML for each date group
        const html = sortedDates.map(date => {
          const records = recordsByDate[date];
          const confirmedCount = records.filter(r => !r.disregardedBy).length;
          const disregardedCount = records.filter(r => r.disregardedBy).length;

          return `
            <div class="historical-item" data-date="${date}" style="cursor: pointer;">
              <div class="historical-date">${date}</div>
              <div class="historical-event">
                ${confirmedCount} confirmed flood${confirmedCount !== 1 ? 's' : ''}${disregardedCount > 0 ? `, ${disregardedCount} disregarded` : ''}
              </div>
              <div class="historical-details">
                Click to view detailed flood records for this date
              </div>
            </div>
          `;
        }).join('');

        historicalDataGrid.innerHTML = html;

        // Add click event listeners to date items
        historicalDataGrid.querySelectorAll('.historical-item').forEach(item => {
          item.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const date = target.getAttribute('data-date');
            if (date) {
              // Open detailed records page in new tab
              const records = recordsByDate[date] || [];
              const recordsParam = encodeURIComponent(JSON.stringify(records));
              const url = `detailed-records.html?date=${encodeURIComponent(date)}&records=${recordsParam}`;
              window.open(url, '_blank');
            }
          });
        });
      };

      await loadHistoricalFloodData();
    }

    // Also refresh historical data grid if it exists (even when modal is closed)
    const historicalDataGrid = document.getElementById('historicalDataGrid');
    if (historicalDataGrid) {
      const floodRecords = await loadFloodRecords();
      const disregardRecords = await loadDisregardRecords();
      const allRecords = [...floodRecords, ...disregardRecords];
      const recordsByDate: { [key: string]: any[] } = {};

      allRecords.forEach(record => {
        const date = new Date(record.timestamp).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        if (!recordsByDate[date]) recordsByDate[date] = [];
        recordsByDate[date].push(record);
      });

      const sortedDates = Object.keys(recordsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      if (sortedDates.length === 0) {
        historicalDataGrid.innerHTML = `
          <div class="no-historical-data">
            <div class="no-data-icon">📊</div>
            <div class="no-data-text">No flood records found</div>
            <div class="no-data-subtext">Flood confirmations will appear here when recorded</div>
          </div>
        `;
      } else {
        const html = sortedDates.map(date => {
          const records = recordsByDate[date];
          const confirmedCount = records.filter(r => !r.disregardedBy).length;
          const disregardedCount = records.filter(r => r.disregardedBy).length;
          return `
            <div class="historical-item" data-date="${date}" style="cursor: pointer;">
              <div class="historical-date">${date}</div>
              <div class="historical-event">
                ${confirmedCount} confirmed flood${confirmedCount !== 1 ? 's' : ''}${disregardedCount > 0 ? `, ${disregardedCount} disregarded` : ''}
              </div>
              <div class="historical-details">
                Click to view detailed flood records for this date
              </div>
            </div>
          `;
        }).join('');

        historicalDataGrid.innerHTML = html;

        // Click to open detailed records page in new tab
        historicalDataGrid.querySelectorAll('.historical-item').forEach(item => {
          item.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const date = target.getAttribute('data-date');
            if (!date) return;

            // Open detailed records page in new tab
            const records = recordsByDate[date] || [];
            const recordsParam = encodeURIComponent(JSON.stringify(records));
            const url = `detailed-records.html?date=${encodeURIComponent(date)}&records=${recordsParam}`;
            window.open(url, '_blank');
          });
        });
      }
    }
  };

  // Handle high-risk alert notification click
  const handleHighRiskAlertClick = async (e: Event) => {
    console.log('High-risk alert notification clicked');
    const target = e.target as HTMLElement;
    const notificationItem = target.closest('.high-risk-alert-notification') as HTMLElement;
    console.log('Notification item found:', notificationItem);
    if (!notificationItem) return;

    const index = parseInt(notificationItem.getAttribute('data-index') || '0');
    console.log('Notification index:', index);
    const notifications = await firebaseService.loadNotifications();
    console.log('Notifications from storage:', notifications);
    const notification = notifications[index];
    console.log('Selected notification:', notification);

    if (notification && notification.highRiskAreas) {
      console.log('Calling showHighRiskModal with areas:', notification.highRiskAreas);
      showHighRiskModal(notification.highRiskAreas, notification.isSimulation);
    } else {
      console.log('No high risk areas found in notification');
    }
  };

  // Show high-risk areas modal
  const showHighRiskModal = (highRiskAreas: any[], isSimulation: boolean) => {
    console.log('showHighRiskModal called with areas:', highRiskAreas);
    const modal = document.getElementById('highRiskModal');
    const areasList = document.getElementById('highRiskAreasList');

    console.log('Modal element:', modal);
    console.log('Areas list element:', areasList);

    if (!modal || !areasList) {
      console.log('Modal or areas list not found');
      return;
    }

    // Populate the modal with high-risk areas
    areasList.innerHTML = highRiskAreas.map(area => {
      const currentFloodRisk = area.simulatedFloodRisk || area.floodRisk;
      const currentLandslideRisk = area.simulatedLandslideRisk || area.landslideRisk;
      const riskType = currentFloodRisk === 'high' ? 'flood' : 'landslide';
      const riskLevel = currentFloodRisk === 'high' ? currentFloodRisk : currentLandslideRisk;

      return `
        <div class="high-risk-area-item" data-area-id="${area.id}">
          <div class="high-risk-area-info">
            <div class="high-risk-area-name">${area.name}</div>
            <div class="high-risk-area-details">Type: ${area.type} • Population: ${area.population || 'N/A'}</div>
            <div class="high-risk-area-risk">High ${riskType} risk${isSimulation ? ' (Simulated)' : ''}</div>
          </div>
          <div class="high-risk-area-actions">
            <button class="high-risk-confirm-btn" data-action="confirm" data-area-id="${area.id}">Confirm Flood</button>
            <button class="high-risk-disregard-btn" data-action="disregard" data-area-id="${area.id}">Disregard</button>
          </div>
        </div>
      `;
    }).join('');

    console.log('Modal content populated with', highRiskAreas.length, 'areas');

    // Remove any existing event listeners to prevent duplicates
    const oldListener = (areasList as any)._highRiskClickListener;
    if (oldListener) {
      areasList.removeEventListener('click', oldListener);
    }

    // Add single event listener using event delegation (more reliable)
    const handleHighRiskClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const button = target.closest('.high-risk-confirm-btn, .high-risk-disregard-btn') as HTMLElement;

      if (!button) return;

      const action = button.getAttribute('data-action');
      const areaId = button.getAttribute('data-area-id');

      console.log('High-risk button clicked:', { action, areaId, button: button.className });

      if (action && areaId) {
        const area = highRiskAreas.find(a => String(a.id) === String(areaId));
        console.log('Found area:', area);

        if (area) {
          if (action === 'confirm') {
            setSelectedAreaForFloodReport(area);
            setIsFloodEventFormModalOpen(true);
            const highRiskModal = document.getElementById('highRiskModal');
            if (highRiskModal) {
              highRiskModal.classList.remove('active');
            }
          } else {
            // Store action details for the modal
            (window as any).pendingFloodAction = { action, areaId, area };
            console.log('Stored pending action:', (window as any).pendingFloodAction);

            // Show flood confirmation modal
            const floodModal = document.getElementById('floodConfirmModal');
            const floodMessage = document.getElementById('floodConfirmMessage');
            const floodConfirmBtn = document.getElementById('floodConfirmBtn');

            console.log('Flood modal elements:', { floodModal, floodMessage, floodConfirmBtn });

            if (floodModal && floodMessage && floodConfirmBtn) {
              const actionText = 'disregard this flood alert';
              floodMessage.textContent = `Are you sure you want to ${actionText} for "${area.name}"?`;
              floodConfirmBtn.textContent = 'Disregard';

              // Show modal and enforce visibility
              floodModal.classList.add('active');
              (floodModal as HTMLElement).style.display = 'flex';
              (floodModal as HTMLElement).style.position = 'fixed';
              (floodModal as HTMLElement).style.top = '0';
              (floodModal as HTMLElement).style.left = '0';
              (floodModal as HTMLElement).style.width = '100%';
              (floodModal as HTMLElement).style.height = '100%';
              (floodModal as HTMLElement).style.background = 'rgba(7, 22, 36, 0.8)';
              (floodModal as HTMLElement).style.backdropFilter = 'blur(8px)';
              (floodModal as HTMLElement).style.zIndex = '10001'; // Higher than high-risk modal
              (floodModal as HTMLElement).style.alignItems = 'center';
              (floodModal as HTMLElement).style.justifyContent = 'center';

              console.log('Flood confirm modal opened successfully');
            } else {
              console.error('Flood modal elements not found');
            }
          }
        } else {
          console.warn('High-risk area not found for id:', areaId, 'Available areas:', highRiskAreas.map(a => ({id: a.id, name: a.name})));
        }
      } else {
        console.warn('Missing action or areaId attributes on button');
      }
    };

    // Store reference to listener for cleanup
    (areasList as any)._highRiskClickListener = handleHighRiskClick;

    // Add the event listener
    areasList.addEventListener('click', handleHighRiskClick);
    console.log('Event listener attached to areas list');

    // Show the modal
    console.log('Adding active class to modal');
    modal.classList.add('active');
    console.log('Modal classes after adding active:', modal.className);

    // Force visibility to ensure it works
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(7, 22, 36, 0.8)';
    modal.style.backdropFilter = 'blur(8px)';
    modal.style.zIndex = '10000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    console.log('Modal display style:', window.getComputedStyle(modal).display);
    console.log('Modal content HTML length:', areasList.innerHTML.length);

    // Verify buttons exist
    const confirmButtons = areasList.querySelectorAll('.high-risk-confirm-btn');
    const disregardButtons = areasList.querySelectorAll('.high-risk-disregard-btn');
    console.log('Found confirm buttons:', confirmButtons.length);
    console.log('Found disregard buttons:', disregardButtons.length);
  };

  // Generate notifications based on weather conditions
  const generateNotifications = async (weather: WeatherData, forecast: ForecastDay[]) => {
    const notificationsList = document.getElementById('notificationsList');
    const notificationBadge = document.getElementById('notificationBadge');

    if (!notificationsList || !notificationBadge) return;

    const notifications: Array<{
      type: 'critical' | 'warning' | 'info' | 'area-alert' | 'high-risk-alert';
      title: string;
      message: string;
      time: string;
      areaId?: string;
      hasActions?: boolean;
      highRiskAreas?: any[];
      isSimulation?: boolean;
    }> = [];

    // Check for high-risk areas and create a single notification if any exist
    const highRiskAreas = monitoredAreas.filter(area => {
      const currentFloodRisk = area.simulatedFloodRisk || area.floodRisk;
      const currentLandslideRisk = area.simulatedLandslideRisk || area.landslideRisk;
      return currentFloodRisk === 'high' || currentLandslideRisk === 'high';
    });

    if (highRiskAreas.length > 0) {
      const isSimulation = currentSimulation && highRiskAreas.some(area => area.isSimulated);
      const contextText = isSimulation ? ` during ${getWeatherConditionName(currentSimulation)} simulation` : '';

      notifications.push({
        type: 'high-risk-alert' as any,
        title: '🚨 High Risk Areas Detected',
        message: `${highRiskAreas.length} area${highRiskAreas.length > 1 ? 's' : ''} detected with high flood or landslide risk${contextText}. Click to review and confirm flood events.`,
        time: new Date().toLocaleTimeString(),
        highRiskAreas: highRiskAreas,
        isSimulation: !!isSimulation
      });
    } else {
      // Add mock high-risk alert for testing the modal functionality when no real high-risk areas exist
      const mockHighRiskAreas = [
        {
          id: 'mock-1',
          name: 'Downtown District',
          type: 'commercial',
          floodRisk: 'high',
          population: 500,
          coordinates: [12.002, 125.502]
        },
        {
          id: 'mock-2',
          name: 'Residential Zone A',
          type: 'residential',
          floodRisk: 'high',
          population: 200,
          coordinates: [12.003, 125.503]
        }
      ];

      notifications.push({
        type: 'high-risk-alert' as any,
        title: '🚨 High Risk Areas Detected (Test)',
        message: '2 areas detected with high flood risk. Click to review and confirm flood events.',
        time: new Date().toLocaleTimeString(),
        highRiskAreas: mockHighRiskAreas,
        isSimulation: false
      });
    }

    // Check current weather conditions
    if (weather.precipitation > 10) {
      notifications.push({
        type: 'critical',
        title: 'Heavy Rainfall Alert',
        message: `Heavy rainfall detected (${weather.precipitation}mm). High flood risk in monitored areas.`,
        time: new Date().toLocaleTimeString()
      });
    } else if (weather.precipitation > 5) {
      notifications.push({
        type: 'warning',
        title: 'Moderate Rainfall',
        message: `Moderate rainfall (${weather.precipitation}mm). Monitor flood-prone areas closely.`,
        time: new Date().toLocaleTimeString()
      });
    }

    if (weather.windSpeed > 15) {
      notifications.push({
        type: 'warning',
        title: 'Strong Winds',
        message: `Wind speeds of ${weather.windSpeed} m/s detected. Monitor for potential hazards.`,
        time: new Date().toLocaleTimeString()
      });
    }

    // Check forecast for upcoming risks
    const highRiskDays = forecast.filter(day => day.riskLevel === 'high');
    if (highRiskDays.length > 0) {
      notifications.push({
        type: 'warning',
        title: 'High Risk Forecast',
        message: `${highRiskDays.length} day(s) with high flood risk expected in the forecast.`,
        time: new Date().toLocaleTimeString()
      });
    }

    // System status notifications
    if (notifications.length === 0) {
      notifications.push({
        type: 'info',
        title: 'System Status',
        message: 'All monitoring systems operating normally. Weather conditions stable.',
        time: new Date().toLocaleTimeString()
      });
    }

    // Add a mock notification for testing/demo purposes
    notifications.push({
      type: 'warning',
      title: 'Weather Monitoring Active',
      message: 'Flood monitoring system is actively tracking weather conditions in Oras, Eastern Samar.',
      time: new Date().toLocaleTimeString()
    });


    // Save notifications to Firebase for handler access
    await firebaseService.saveNotifications(notifications);

    // Update notifications list
    if (notifications.length > 0) {
      notificationsList.innerHTML = notifications.map((notification, index) => {
        if (notification.type === 'high-risk-alert') {
          return `
            <div class="notification-item ${notification.type} unread high-risk-alert-notification" data-index="${index}">
              <div class="notification-time">${notification.time}</div>
              <div class="notification-title">${notification.title}</div>
              <div class="notification-message">${notification.message}</div>
            </div>
          `;
        } else if ((notification as any).type === 'high-risk-alert') {
          return `
            <div class="notification-item ${notification.type} unread high-risk-alert-notification" data-index="${index}">
              <div class="notification-time">${notification.time}</div>
              <div class="notification-title">${notification.title}</div>
              <div class="notification-message">${notification.message}</div>
              <div class="notification-actions">
                <button class="action-btn confirm-btn" data-action="confirm-high-risk" data-index="${index}">Confirm All</button>
                <button class="action-btn disregard-btn" data-action="disregard-high-risk" data-index="${index}">Disregard All</button>
                <button class="action-btn review-btn" data-action="review-high-risk" data-index="${index}">Review</button>
              </div>
            </div>
          `;
        } else if (notification.hasActions && notification.areaId) {
          return `
            <div class="notification-item ${notification.type} unread" data-area-id="${notification.areaId}" data-index="${index}">
              <div class="notification-time">${notification.time}</div>
              <div class="notification-title">${notification.title}</div>
              <div class="notification-message">${notification.message}</div>
              <div class="notification-actions">
                <button class="action-btn confirm-btn" data-action="confirm" data-area-id="${notification.areaId}">Confirm Flood</button>
                <button class="action-btn disregard-btn" data-action="disregard" data-area-id="${notification.areaId}">Disregard</button>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="notification-item ${notification.type} unread">
              <div class="notification-time">${notification.time}</div>
              <div class="notification-title">${notification.title}</div>
              <div class="notification-message">${notification.message}</div>
            </div>
          `;
        }
      }).join('');
    } else {
      notificationsList.innerHTML = `
        <div class="no-notifications">
          <div class="no-notifications-icon">🔔</div>
          <div class="no-notifications-text">No active alerts</div>
          <div class="no-notifications-subtext">All systems operating normally</div>
        </div>
      `;
    }

    // Add event listeners for action buttons
    notificationsList.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', handleNotificationAction);
    });

    // Add event listeners for high-risk alert notifications
    notificationsList.querySelectorAll('.high-risk-alert-notification').forEach(btn => {
      btn.addEventListener('click', handleHighRiskAlertClick);
    });

    // Update badge
    const unreadCount = notifications.filter(n => n.type !== 'info').length;
    if (unreadCount > 0) {
      notificationBadge.style.display = 'flex';
      notificationBadge.textContent = unreadCount.toString();
    } else {
      notificationBadge.style.display = 'none';
    }
  };

  // Fetch weather data
  const fetchWeatherData = async () => {
    try {
      const API_KEY = '892b7ee2e8f0e34c8a6d580ed06dc2a8';
      const lat = 12.1113;
      const lon = 125.3756;

      // Fetch current weather
      const currentWeatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );

      if (!currentWeatherResponse.ok) {
        throw new Error(`Current weather API error: ${currentWeatherResponse.status}`);
      }

      const currentWeatherData = await currentWeatherResponse.json();

      // Fetch 5-day forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );

      if (!forecastResponse.ok) {
        throw new Error(`Forecast API error: ${forecastResponse.status}`);
      }

      const forecastData = await forecastResponse.json();

      // Process current weather data
      const weatherData: WeatherData = {
        temperature: Math.round(currentWeatherData.main.temp),
        description: currentWeatherData.weather[0].description,
        humidity: currentWeatherData.main.humidity,
        windSpeed: Math.round(currentWeatherData.wind.speed * 10) / 10, // Round to 1 decimal
        windDirection: currentWeatherData.wind.deg,
        precipitation: currentWeatherData.rain?.['1h'] || 0,
        pressure: currentWeatherData.main.pressure,
        visibility: currentWeatherData.visibility ? currentWeatherData.visibility / 1000 : 10, // Convert to km
        feelsLike: Math.round(currentWeatherData.main.feels_like),
        cloudiness: currentWeatherData.clouds?.all || 0,
        dewPoint: currentWeatherData.main.temp - ((100 - currentWeatherData.main.humidity) / 5) // Approximate dew point
      };

      // Process forecast data - group by day
      const dailyForecasts: { [key: string]: any[] } = {};

      forecastData.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toDateString();

        if (!dailyForecasts[dateKey]) {
          dailyForecasts[dateKey] = [];
        }
        dailyForecasts[dateKey].push(item);
      });

      // Create forecast days (take first 5 days)
      const forecastDays: ForecastDay[] = Object.keys(dailyForecasts)
        .slice(0, 5)
        .map((dateKey, index) => {
          const dayData = dailyForecasts[dateKey];
          const date = new Date(dateKey);

          // Calculate aggregates - be more conservative with precipitation
          const temps = dayData.map((item: any) => item.main.temp);
          const humidities = dayData.map((item: any) => item.main.humidity);
          const windSpeeds = dayData.map((item: any) => item.wind.speed);
          const precipitations = dayData.map((item: any) => item.rain?.['3h'] || 0);

          // Use maximum precipitation value instead of total to avoid over-estimation
          const maxPrecipitation = Math.max(...precipitations);
          // Or use a more conservative total - take the highest 3-hour period and multiply by a factor
          const totalPrecipitation = Math.min(maxPrecipitation * 2, precipitations.reduce((sum: number, p: number) => sum + p, 0));
          const avgWindSpeed = windSpeeds.reduce((sum: number, w: number) => sum + w, 0) / windSpeeds.length;
          const avgHumidity = humidities.reduce((sum: number, h: number) => sum + h, 0) / humidities.length;

          // Get most common weather condition
          const conditions = dayData.map((item: any) => ({
            description: item.weather[0].description,
            icon: item.weather[0].icon
          }));

          // Use the condition from midday (around 12:00) or first one
          const middayCondition = conditions.find((_, idx) => {
            const hour = new Date(dayData[idx].dt * 1000).getHours();
            return hour >= 11 && hour <= 13;
          }) || conditions[0];

          // Determine risk level - use more conservative thresholds
          let riskLevel: 'low' | 'medium' | 'high' = 'low';
          if (totalPrecipitation > 15 || avgWindSpeed > 20) riskLevel = 'high';
          else if (totalPrecipitation > 5 || avgWindSpeed > 10) riskLevel = 'medium';

          return {
            date: date.toISOString(),
            dayName: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
            temperature: {
              min: Math.round(Math.min(...temps)),
              max: Math.round(Math.max(...temps))
            },
            humidity: Math.round(avgHumidity),
            precipitation: Math.round(totalPrecipitation * 10) / 10,
            windSpeed: Math.round(avgWindSpeed),
            description: middayCondition.description,
            icon: middayCondition.icon,
            riskLevel
          };
        });

      setWeatherData(weatherData);
      setForecast(forecastDays);
      setLastUpdated(new Date().toLocaleTimeString());

      // Update current weather display
      updateCurrentWeatherDisplay(weatherData, forecastDays[0]);

      // Update forecast display
      updateForecastDisplay(forecastDays);

      // Check for weather alerts
      checkWeatherAlerts(weatherData, forecastDays);

      // Generate notifications
      await generateNotifications(weatherData, forecastDays);

      // Run real-time simulation if enabled
      setTimeout(() => runRealTimeSimulation(), 100);

    } catch (error) {
      console.error('Error fetching weather data:', error);
      // Fallback to mock data if API fails
      const fallbackWeatherData: WeatherData = {
        temperature: 28,
        description: 'Weather data unavailable',
        humidity: 70,
        windSpeed: 5,
        precipitation: 0,
        pressure: 1013,
        visibility: 10,
        feelsLike: 30,
        cloudiness: 50
      };

      const today = new Date();
      const fallbackForecast: ForecastDay[] = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        // Generate more realistic weather data that won't always trigger typhoon
        const basePrecipitation = i === 0 ? 0.5 : Math.random() * 3; // 0-3mm for realistic conditions
        const baseWindSpeed = 3 + Math.random() * 4; // 3-7 m/s for normal conditions

        return {
          date: date.toISOString(),
          dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' }),
          temperature: { min: 25, max: 32 },
          humidity: 70,
          precipitation: Math.round(basePrecipitation * 10) / 10,
          windSpeed: Math.round(baseWindSpeed),
          description: basePrecipitation > 1 ? 'Light rain' : 'Partly cloudy',
          icon: basePrecipitation > 1 ? '10d' : '02d',
          riskLevel: basePrecipitation > 1 ? 'medium' : 'low' as 'low' | 'medium'
        };
      });

      setWeatherData(fallbackWeatherData);
      setForecast(fallbackForecast);
      setLastUpdated(new Date().toLocaleTimeString());

      updateCurrentWeatherDisplay(fallbackWeatherData, fallbackForecast[0]);
      updateForecastDisplay(fallbackForecast);
      checkWeatherAlerts(fallbackWeatherData, fallbackForecast);
      await generateNotifications(fallbackWeatherData, fallbackForecast);
    }
  };

  const updateCurrentWeatherDisplay = (weather: WeatherData, todayForecast: ForecastDay) => {
    const currentTemp = document.getElementById('current-temp-display');
    const currentCondition = document.getElementById('current-condition-display');
    const currentHumidity = document.getElementById('current-humidity-display');
    const currentWind = document.getElementById('current-wind-display');
    const currentRain = document.getElementById('current-rain-display');
    const currentRisk = document.getElementById('current-risk-display');
    const lastUpdatedEl = document.getElementById('last-updated-display');

    // Additional weather elements
    const currentFeelsLike = document.getElementById('current-feels-like-display');
    const currentPressure = document.getElementById('current-pressure-display');
    const currentVisibility = document.getElementById('current-visibility-display');
    const currentCloudiness = document.getElementById('current-cloudiness-display');
    const currentDewPoint = document.getElementById('current-dew-point-display');

    if (currentTemp) currentTemp.textContent = `${weather.temperature}°`;

    // Add raining indicator to condition if precipitation > 0
    const conditionText = weather.precipitation > 0
      ? `${weather.description} 🌧️`
      : weather.description;
    if (currentCondition) currentCondition.textContent = conditionText;

    if (currentHumidity) currentHumidity.textContent = `${weather.humidity}%`;
    if (currentWind) {
      const windDir = weather.windDirection ? ` ${getWindDirection(weather.windDirection)}` : '';
      currentWind.textContent = `${weather.windSpeed} m/s${windDir}`;
    }
    if (currentRain) currentRain.textContent = `${weather.precipitation.toFixed(1)}mm`;
    if (currentRisk) currentRisk.textContent = todayForecast.riskLevel;
    if (lastUpdatedEl) lastUpdatedEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;

    // Update additional weather data
    if (currentFeelsLike) currentFeelsLike.textContent = `${weather.feelsLike}°`;
    if (currentPressure) currentPressure.textContent = `${weather.pressure} hPa`;
    if (currentVisibility) currentVisibility.textContent = `${weather.visibility.toFixed(1)} km`;
    if (currentCloudiness) currentCloudiness.textContent = `${weather.cloudiness}%`;
    if (currentDewPoint && weather.dewPoint) currentDewPoint.textContent = `${Math.round(weather.dewPoint)}°`;

    // Update system status
    updateSystemStatus();
  };

  // Update system status indicators
  const updateSystemStatus = () => {
    const dataReliabilityEl = document.getElementById('data-reliability-display');
    if (dataReliabilityEl) {
      // Simulate data reliability (in real app, this would be calculated)
      const reliability = Math.floor(95 + Math.random() * 5); // 95-100%
      dataReliabilityEl.textContent = `Reliability: ${reliability}%`;
    }
  };

  const updateForecastDisplay = (forecastData: ForecastDay[]) => {
    const container = document.getElementById('floatingForecastGrid');
    if (!container) return;

    container.innerHTML = `<div class="forecast-grid">${forecastData.slice(0, 5).map(day => `
      <div class="forecast-item ${day.riskLevel}-risk">
        <div class="risk-indicator"></div>
        <div class="forecast-icon">${getWeatherIcon(day.icon)}</div>
        <div class="forecast-day-info">
          <div class="forecast-day-name">${day.dayName}</div>
          <div class="forecast-condition">${day.description}</div>
        </div>
        <div class="forecast-precipitation">${day.precipitation}mm</div>
        <div class="forecast-temp">${day.temperature.max}°/${day.temperature.min}°</div>
      </div>
    `).join('')}</div>`;
  };

  const getWeatherIcon = (iconCode: string) => {
    const icons: { [key: string]: string } = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌦️'
    };
    return icons[iconCode] || '☁️';
  };

  // Make focusOnArea globally available

  const checkWeatherAlerts = (weather: WeatherData, forecast: ForecastDay[]) => {
    const alertSystem = document.getElementById('alertSystem');
    const alertMessage = document.getElementById('alertMessage');
    
    if (!alertSystem || !alertMessage) return;
    
    let alertLevel = 'low';
    let alertText = '';
    
    // Check current weather conditions
    if (weather.precipitation > 10) {
      alertLevel = 'high';
      alertText = 'Heavy rainfall detected. High flood risk in monitored areas.';
    } else if (weather.precipitation > 5) {
      alertLevel = 'medium';
      alertText = 'Moderate rainfall. Monitor flood-prone areas closely.';
    } else if (weather.windSpeed > 15) {
      alertLevel = 'medium';
      alertText = 'Strong winds detected. Monitor for potential hazards.';
    }
    
    // Check forecast for upcoming risks
    const upcomingHighRisk = forecast.slice(1, 3).some(day => day.riskLevel === 'high');
    if (upcomingHighRisk && alertLevel === 'low') {
      alertLevel = 'medium';
      alertText = 'High risk weather conditions expected in the next 2 days.';
    }
    
    // Update alert display
    if (alertLevel !== 'low') {
      alertSystem.style.display = 'block';
      alertSystem.className = `alert-system ${alertLevel}-alert`;
      alertMessage.textContent = alertText;
    } else {
      alertSystem.style.display = 'none';
    }
  };
  useEffect(() => {
    (window as any).focusOnArea = (areaId: string) => {
      const area = monitoredAreas.find(a => a.id === areaId);
      if (area && mapInstanceRef.current) {
        mapInstanceRef.current.setView(area.coordinates, 16);
      }
    };
  }, [monitoredAreas]);

  // Update button states when state changes
  useEffect(() => {
    updateButtonStates();
  }, [isAddingMarker, isDrawingPolygon]);

  // Update simulation function refs
  useEffect(() => {
    simulationFunctionsRef.current = {
      simulateWeatherCondition,
      resetSimulation
    };
  }, [simulateWeatherCondition, resetSimulation]);

  // Update areas list when monitoredAreas changes or when simulation state changes
  useEffect(() => {
    forceUpdateAreasList();

    // Save to Firebase whenever areas change (except during initial load)
    if (monitoredAreas.length > 0) {
      saveAreasToStorage(monitoredAreas).catch(error => {
        console.error('Error saving areas to Firebase:', error);
      });
    }
  }, [monitoredAreas, currentSimulation, forceUpdateAreasList]);

  // Generate notifications when simulation state changes
  useEffect(() => {
    const generateNotificationsAsync = async () => {
      if (weatherData && forecast.length > 0) {
        await generateNotifications(weatherData, forecast);
      }
    };
    generateNotificationsAsync();
  }, [currentSimulation, weatherData, forecast]);

  // Initial weather fetch and setup interval
  useEffect(() => {
    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 5 * 60 * 1000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Run real-time simulation when weather data first becomes available
  useEffect(() => {
    if (weatherData && forecast.length > 0 && realTimeSimulationEnabled) {
      // Only run if we have reasonable weather data (not extreme values that would indicate API error)
      const hasReasonableData = weatherData.precipitation < 50 && weatherData.windSpeed < 30;
      const hasReasonableForecast = forecast.every(day => day.precipitation < 50 && day.windSpeed < 30);

      if (hasReasonableData && hasReasonableForecast) {
        // Small delay to ensure everything is loaded
        const timer = setTimeout(() => {
          runRealTimeSimulation();
        }, 500);
        return () => clearTimeout(timer);
      } else {
        console.log('Skipping real-time simulation due to extreme weather values (possible API issue)');
      }
    }
  }, [weatherData, forecast, realTimeSimulationEnabled, runRealTimeSimulation]);

  // Setup event listeners for buttons and toggles
  useEffect(() => {


    // Risk calculation input listeners
    const riskInputs = [
      'elevation', 'distanceFromWater', 'soilPermeability', 'slopeGradient',
      'drainageCondition', 'vegetationCover', 'floodHistory', 'areaType'
    ];

    const handleRiskInputChange = () => {
      updateRiskCalculation();
    };

    // Add listeners to risk calculation inputs
    riskInputs.forEach(inputId => {
      const element = document.getElementById(inputId);
      if (element) {
        element.addEventListener('input', handleRiskInputChange);
        element.addEventListener('change', handleRiskInputChange);
      }
    });

    // Override checkbox handler
    const overrideCheckbox = document.getElementById('overrideRisk') as HTMLInputElement;
    const floodRiskSelect = document.getElementById('floodRisk') as HTMLSelectElement;

    const handleOverrideChange = () => {
      if (floodRiskSelect) {
        floodRiskSelect.disabled = !overrideCheckbox?.checked;
        if (!overrideCheckbox?.checked) {
          // Re-calculate if override is disabled
          updateRiskCalculation();
        }
      }
    };

    if (overrideCheckbox) {
      overrideCheckbox.addEventListener('change', handleOverrideChange);
    }

    // Add marker button
    const addMarkerBtn = document.getElementById('addMarkerBtn');
    // Draw polygon button
    const drawPolygonBtn = document.getElementById('drawPolygonBtn');
    // Icon size slider
    const iconSizeSlider = document.getElementById('iconSizeSlider');
    // Theme toggle
    const themeSwitch = document.getElementById('themeSwitch');
    // Forecast toggle
    const forecastToggle = document.getElementById('forecastToggle');
    // Simulation toggle
    const simulationToggle = document.getElementById('simulationToggle');
    // Weather simulation buttons
    const weatherButtons = document.querySelectorAll('.weather-condition-btn');
    const resetButton = document.getElementById('resetSimulation');
    // Real-time simulation toggle
    const realTimeToggle = document.getElementById('realTimeToggle');
    // Notifications button
    const notificationsBtn = document.getElementById('notificationsBtn');
    // Clear notifications button
    const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');
    // Archive button
    const archiveBtn = document.getElementById('archiveBtn');
    // View historical data button
    const viewHistoricalBtn = document.getElementById('viewHistoricalBtn');
    // Historical modal close button
    const historicalModalClose = document.getElementById('historicalModalClose');
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    // Modal buttons
    const cancelBtn = document.getElementById('cancelBtn');
    const saveAreaBtn = document.getElementById('saveAreaBtn');
    // Delete confirmation modal buttons
  const deleteCancelBtn = document.getElementById('deleteCancelBtn');
  const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => {
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.classList.remove('active');
    });
  }

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const id = target.getAttribute('data-id');
      if (id) {
        deleteArea(id);
      }
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Flood confirmation modal buttons
  const floodCancelBtn = document.getElementById('floodCancelBtn');
  const floodConfirmBtn = document.getElementById('floodConfirmBtn');

  if (floodCancelBtn) {
    floodCancelBtn.addEventListener('click', () => {
      const modal = document.getElementById('floodConfirmModal');
      if (modal) modal.classList.remove('active');
      // Clear pending action
      (window as any).pendingFloodAction = null;
    });
  }

  if (floodConfirmBtn) {
    floodConfirmBtn.addEventListener('click', () => {
      handleFloodConfirmation(true);
    });
  }

  // Fallback delegation to ensure modal buttons work even if direct bindings fail
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.id === 'floodConfirmBtn') {
      e.preventDefault();
      e.stopPropagation();
      handleFloodConfirmation(true);
    } else if (target.id === 'floodCancelBtn') {
      e.preventDefault();
      e.stopPropagation();
      const modal = document.getElementById('floodConfirmModal');
      if (modal) {
        modal.classList.remove('active');
        (modal as HTMLElement).style.display = 'none';
      }
      (window as any).pendingFloodAction = null;
    } else {
      // Delegated handler for historical date items
      const historicalItem = target.closest('.historical-item') as HTMLElement | null;
      if (historicalItem) {
        e.preventDefault();
        const date = historicalItem.getAttribute('data-date') || '';
        console.log('Historical date clicked:', date);

        // Build recordsByDate from Firebase
        const floodRecords = await loadFloodRecords();
        const disregardRecords = await loadDisregardRecords();
        const allRecords = [...floodRecords, ...disregardRecords];
        const recordsByDate: { [key: string]: any[] } = {};
        allRecords.forEach(record => {
          const d = new Date(record.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          if (!recordsByDate[d]) recordsByDate[d] = [];
          recordsByDate[d].push(record);
        });

        // Open detailed records page in new tab
        const records = recordsByDate[date] || [];
        const recordsParam = encodeURIComponent(JSON.stringify(records));
        const url = `detailed-records.html?date=${encodeURIComponent(date)}&records=${recordsParam}`;
        window.open(url, '_blank');
        console.log('Opened detailed records page with', records.length, 'records for', date);
      }
    }
  });

  // High-risk modal close button
  const highRiskModalClose = document.getElementById('highRiskModalClose');
  console.log('High-risk modal close button element:', highRiskModalClose);

  if (highRiskModalClose) {
    highRiskModalClose.addEventListener('click', () => {
      console.log('High-risk modal close button clicked');
      const modal = document.getElementById('highRiskModal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none'; // Also remove inline display style
        console.log('High-risk modal closed');
      }
    });
    console.log('Event listener added to high-risk modal close button');
  } else {
    console.log('High-risk modal close button not found');
  }

  // Detailed records modal close button
  const detailedRecordsModalClose = document.getElementById('detailedRecordsModalClose');

  if (detailedRecordsModalClose) {
    detailedRecordsModalClose.addEventListener('click', () => {
      const modal = document.getElementById('detailedRecordsModal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
    });
  }

    // Event handlers
    const handleAddMarker = () => {
      console.log('Add marker button clicked');
      if (isAddingMarker) {
        // If already in marker mode, turn it off
        setIsAddingMarker(false);
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.classList.remove('drawing-mode');
        }
      } else {
        // Turn on marker mode and turn off polygon mode
        setIsAddingMarker(true);
        setIsDrawingPolygon(false);
        
        // Remove draw control if it's active
        if (mapInstanceRef.current && drawControlRef.current && mapInstanceRef.current.hasLayer(drawControlRef.current)) {
          mapInstanceRef.current.removeControl(drawControlRef.current);
        }
        
        // Add drawing cursor
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.classList.add('drawing-mode');
        }
      }
    };
    
    const handleDrawPolygon = () => {
      console.log('Draw polygon button clicked');
      if (isDrawingPolygon) {
        // If already in drawing mode, turn it off
        setIsDrawingPolygon(false);
        
        // Remove draw control
        if (mapInstanceRef.current && drawControlRef.current && mapInstanceRef.current.hasLayer(drawControlRef.current)) {
          mapInstanceRef.current.removeControl(drawControlRef.current);
        }
        
        // Remove drawing cursor
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.classList.remove('drawing-mode');
        }
      } else {
        // Turn on drawing mode and turn off marker mode
        setIsDrawingPolygon(true);
        setIsAddingMarker(false);
        
        // Enable drawing mode
        if (mapInstanceRef.current && drawControlRef.current) {
          if (!mapInstanceRef.current.hasLayer(drawControlRef.current)) {
            mapInstanceRef.current.addControl(drawControlRef.current);
          }
        }
        
        // Add drawing cursor
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.classList.add('drawing-mode');
        }
      }
    };
    
    const handleIconSizeChange = (e: Event) => {
      const slider = e.target as HTMLInputElement;
      const newSize = parseInt(slider.value);
      setIconSize(newSize);
      updateAllMarkerSizes(newSize);
      
      // Update the display value
      const sizeValue = document.getElementById('iconSizeValue');
      if (sizeValue) {
        sizeValue.textContent = `${newSize}px`;
      }
    };
    
    const handleThemeToggle = () => {
      toggleTheme();
    };
    
    const handleForecastToggle = () => {
      const panel = document.querySelector('.floating-forecast');
      const toggle = document.getElementById('forecastToggle');
      
      if (panel && toggle) {
        panel.classList.toggle('collapsed');
        const isCollapsed = panel.classList.contains('collapsed');
        toggle.textContent = isCollapsed ? '+' : '−';
      }
    };
    
    const handleSimulationToggle = () => {
      toggleSimulationPanel();
    };
    
    const handleWeatherCondition = (e: Event) => {
      const button = e.currentTarget as HTMLElement;
      const condition = button.getAttribute('data-condition');
      if (condition) {
        // Remove active class from all buttons
        weatherButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        button.classList.add('active');
        // Simulate weather condition
        simulateWeatherCondition(condition);
      }
    };
    
    const handleReset = () => {
      // Remove active class from all buttons
      weatherButtons.forEach(btn => btn.classList.remove('active'));
      // Reset simulation
      resetSimulation();
    };

    const handleRealTimeToggle = () => {
      const newState = !realTimeSimulationEnabled;
      setRealTimeSimulationEnabled(newState);

      if (realTimeToggle) {
        if (newState) {
          realTimeToggle.classList.add('active');
          realTimeToggle.textContent = 'ON';
          // Run real-time simulation immediately if enabled
          runRealTimeSimulation();
        } else {
          realTimeToggle.classList.remove('active');
          realTimeToggle.textContent = 'OFF';
          // Reset to baseline when disabled
          resetSimulation();
        }
      }
    };

    const handleNotificationsClick = (e: Event) => {
      e.stopPropagation();
      const notificationsMenu = document.getElementById('notificationsMenu');
      const notificationsBtn = document.getElementById('notificationsBtn');
      const floatingForecast = document.querySelector('.floating-forecast') as HTMLElement;

      if (notificationsMenu && notificationsBtn) {
        const isActive = notificationsMenu.classList.contains('active');
        if (isActive) {
          notificationsMenu.classList.remove('active');
          notificationsBtn.classList.remove('active');
          // Restore floating forecast z-index
          if (floatingForecast) {
            floatingForecast.style.zIndex = '1000';
          }
        } else {
          // Close any other open dropdowns first
          const archiveMenu = document.getElementById('archiveMenu');
          const archiveBtn = document.getElementById('archiveBtn');
          const settingsMenu = document.getElementById('settingsMenu');
          const settingsBtn = document.getElementById('settingsBtn');
          if (archiveMenu) archiveMenu.classList.remove('active');
          if (archiveBtn) archiveBtn.classList.remove('active');
          if (settingsMenu) settingsMenu.classList.remove('active');
          if (settingsBtn) settingsBtn.classList.remove('active');

          notificationsMenu.classList.add('active');
          notificationsBtn.classList.add('active');
          // Lower floating forecast z-index when notifications are open
          if (floatingForecast) {
            floatingForecast.style.zIndex = '900';
          }
        }
      }
    };

    const handleClearNotifications = async (e: Event) => {
      e.stopPropagation();
      const notificationsList = document.getElementById('notificationsList');
      const notificationBadge = document.getElementById('notificationBadge');

      if (notificationsList) {
        notificationsList.innerHTML = `
          <div class="no-notifications">
            <div class="no-notifications-icon">🔔</div>
            <div class="no-notifications-text">No active alerts</div>
            <div class="no-notifications-subtext">All systems operating normally</div>
          </div>
        `;
      }

      if (notificationBadge) {
        notificationBadge.style.display = 'none';
        notificationBadge.textContent = '0';
      }

      // Clear notifications from Firebase
      await firebaseService.clearNotifications();
    };

    const handleArchiveClick = (e: Event) => {
      e.stopPropagation();
      const archiveMenu = document.getElementById('archiveMenu');
      const archiveBtn = document.getElementById('archiveBtn');

      if (archiveMenu && archiveBtn) {
        const isActive = archiveMenu.classList.contains('active');
        if (isActive) {
          archiveMenu.classList.remove('active');
          archiveBtn.classList.remove('active');
        } else {
          // Close any other open dropdowns first
          const notificationsMenu = document.getElementById('notificationsMenu');
          const notificationsBtn = document.getElementById('notificationsBtn');
          const settingsMenu = document.getElementById('settingsMenu');
          const settingsBtn = document.getElementById('settingsBtn');
          if (notificationsMenu) notificationsMenu.classList.remove('active');
          if (notificationsBtn) notificationsBtn.classList.remove('active');
          if (settingsMenu) settingsMenu.classList.remove('active');
          if (settingsBtn) settingsBtn.classList.remove('active');

          archiveMenu.classList.add('active');
          archiveBtn.classList.add('active');
        }
      }
    };

    // Load and display historical data based on Flood Events (user-submitted reports)
    const loadHistoricalFloodData = async () => {
      const historicalDataGrid = document.getElementById('historicalDataGrid');
      if (!historicalDataGrid) return;
  
      // Load flood events from Firebase
      const events = await firebaseService.loadFloodEvents();
  
      // Group events by date
      const eventsByDate: { [key: string]: any[] } = {};
      events.forEach(ev => {
        const ts = ev.timestamp || ev.submittedAt || ev.dateTime;
        const date = new Date(ts).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        if (!eventsByDate[date]) eventsByDate[date] = [];
        eventsByDate[date].push(ev);
      });
  
      // Sort dates (most recent first)
      const sortedDates = Object.keys(eventsByDate).sort((a, b) =>
        new Date(b).getTime() - new Date(a).getTime()
      );
  
      if (sortedDates.length === 0) {
        historicalDataGrid.innerHTML = `
          <div class="no-historical-data">
            <div class="no-data-icon">📝</div>
            <div class="no-data-text">No flood event submissions found</div>
            <div class="no-data-subtext">Community-submitted flood reports will appear here by date</div>
          </div>
        `;
        return;
      }
  
      // Create HTML for each date group
      const html = sortedDates.map(date => {
        const list = eventsByDate[date];
        const count = list.length;
        return `
          <div class="historical-item" data-date="${date}" style="cursor: pointer;">
            <div class="historical-date">${date}</div>
            <div class="historical-event">
              ${count} flood event${count !== 1 ? 's' : ''} submitted
            </div>
            <div class="historical-details">
              Click to view flood event submissions for this date
            </div>
          </div>
        `;
      }).join('');
  
      historicalDataGrid.innerHTML = html;
  
      // Add click event listeners to date items
      historicalDataGrid.querySelectorAll('.historical-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLElement;
          const date = target.getAttribute('data-date');
          if (date) {
            // Open detailed records page with date only; page will fetch events for that date
            const url = `detailed-records.html?date=${encodeURIComponent(date)}`;
            window.open(url, '_blank');
          }
        });
      });
    };

    // Show detailed flood records for a specific date in a separate modal
    const showDetailedFloodRecords = (date: string, records: any[]) => {
      const detailedRecordsModal = document.getElementById('detailedRecordsModal');
      const detailedRecordsTitle = document.getElementById('detailedRecordsTitle');
      const detailedRecordsList = document.getElementById('detailedRecordsList');

      if (!detailedRecordsModal || !detailedRecordsTitle || !detailedRecordsList) return;

      // Update modal title
      detailedRecordsTitle.textContent = `Flood Records for ${date}`;

      // Create HTML for detailed records
      const html = records.map(record => {
        const isConfirmed = !record.disregardedBy;
        const actionText = isConfirmed ? 'Confirmed' : 'Disregarded';
        const actionColor = isConfirmed ? '#10b981' : '#f59e0b';

        return `
          <div class="detailed-record-item" style="
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 0.75rem;
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div style="font-weight: 600; color: white;">${record.areaName}</div>
              <div style="
                background: ${actionColor};
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
              ">${actionText}</div>
            </div>
            <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.875rem; margin-bottom: 0.5rem;">
              Type: ${record.areaName ? 'Area' : 'Unknown'} • ID: ${record.areaId}
            </div>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">
              ${new Date(record.timestamp).toLocaleTimeString()} • Context: ${record.simulationContext || 'Real-time'}
            </div>
            ${record.weatherConditions ? `
              <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(59, 130, 246, 0.2);">
                <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.75rem;">
                  Weather: ${record.weatherConditions.temperature}°C, ${record.weatherConditions.description}
                  ${record.weatherConditions.precipitation > 0 ? `, ${record.weatherConditions.precipitation}mm rain` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      detailedRecordsList.innerHTML = html;

      // Show the modal
      detailedRecordsModal.classList.add('active');
      detailedRecordsModal.style.display = 'flex';
      detailedRecordsModal.style.position = 'fixed';
      detailedRecordsModal.style.top = '0';
      detailedRecordsModal.style.left = '0';
      detailedRecordsModal.style.width = '100%';
      detailedRecordsModal.style.height = '100%';
      detailedRecordsModal.style.background = 'rgba(7, 22, 36, 0.8)';
      detailedRecordsModal.style.backdropFilter = 'blur(8px)';
      detailedRecordsModal.style.zIndex = '10000';
      detailedRecordsModal.style.alignItems = 'center';
      detailedRecordsModal.style.justifyContent = 'center';
    };

    const handleViewHistoricalClick = async (e: Event) => {
      e.stopPropagation();
      const historicalModal = document.getElementById('historicalModal');
  
      if (historicalModal) {
        // Load and display flood events grouped by date
        await loadHistoricalFloodData();
  
        historicalModal.classList.add('active');
        // Close the archive dropdown
        const archiveMenu = document.getElementById('archiveMenu');
        const archiveBtn = document.getElementById('archiveBtn');
        if (archiveMenu) archiveMenu.classList.remove('active');
        if (archiveBtn) archiveBtn.classList.remove('active');
      }
    };

    const handleHistoricalModalClose = (e: Event) => {
      e.stopPropagation();
      const historicalModal = document.getElementById('historicalModal');

      if (historicalModal) {
        historicalModal.classList.remove('active');
      }
    };

    const handleSettingsClick = (e: Event) => {
      e.stopPropagation();
      const settingsMenu = document.getElementById('settingsMenu');
      const settingsBtn = document.getElementById('settingsBtn');

      if (settingsMenu && settingsBtn) {
        const isActive = settingsMenu.classList.contains('active');
        if (isActive) {
          settingsMenu.classList.remove('active');
          settingsBtn.classList.remove('active');
        } else {
          // Close any other open dropdowns first
          const archiveMenu = document.getElementById('archiveMenu');
          const archiveBtn = document.getElementById('archiveBtn');
          if (archiveMenu) archiveMenu.classList.remove('active');
          if (archiveBtn) archiveBtn.classList.remove('active');

          settingsMenu.classList.add('active');
          settingsBtn.classList.add('active');
        }
      }
    };

    // Close dropdown when clicking outside
    const handleClickOutside = (e: Event) => {
      const notificationsMenu = document.getElementById('notificationsMenu');
      const notificationsBtn = document.getElementById('notificationsBtn');
      const archiveMenu = document.getElementById('archiveMenu');
      const archiveBtn = document.getElementById('archiveBtn');
      const settingsMenu = document.getElementById('settingsMenu');
      const settingsBtn = document.getElementById('settingsBtn');
      const historicalModal = document.getElementById('historicalModal');
      const floodModal = document.getElementById('floodConfirmModal');
      const highRiskModal = document.getElementById('highRiskModal');
      const detailedRecordsModal = document.getElementById('detailedRecordsModal');
      const target = e.target as HTMLElement;

      if (notificationsMenu && notificationsBtn &&
          !notificationsBtn.contains(target) &&
          !notificationsMenu.contains(target)) {
        notificationsMenu.classList.remove('active');
        notificationsBtn.classList.remove('active');
      }

      if (archiveMenu && archiveBtn &&
          !archiveBtn.contains(target) &&
          !archiveMenu.contains(target)) {
        archiveMenu.classList.remove('active');
        archiveBtn.classList.remove('active');
      }

      if (settingsMenu && settingsBtn &&
          !settingsBtn.contains(target) &&
          !settingsMenu.contains(target)) {
        settingsMenu.classList.remove('active');
        settingsBtn.classList.remove('active');
      }

      if (historicalModal &&
          !historicalModal.contains(target)) {
        historicalModal.classList.remove('active');
      }

      if (floodModal &&
          !floodModal.contains(target)) {
        floodModal.classList.remove('active');
        // Clear pending action
        (window as any).pendingFloodAction = null;
      }

      if (highRiskModal &&
          !highRiskModal.contains(target)) {
        highRiskModal.classList.remove('active');
      }

      if (detailedRecordsModal &&
          !detailedRecordsModal.contains(target)) {
        detailedRecordsModal.classList.remove('active');
        detailedRecordsModal.style.display = 'none';
      }
    };
    
    const handleCancel = () => {
      hideAreaModal();
    };
    
    const handleSave = () => {
      saveArea();
    };
    
    // Add event listeners
    if (addMarkerBtn) {
      addMarkerBtn.addEventListener('click', handleAddMarker);
    }
    
    if (drawPolygonBtn) {
      drawPolygonBtn.addEventListener('click', handleDrawPolygon);
    }
    
    if (iconSizeSlider) {
      iconSizeSlider.addEventListener('input', handleIconSizeChange);
    }
    
    if (themeSwitch) {
      themeSwitch.addEventListener('click', handleThemeToggle);
    }
    
    if (forecastToggle) {
      forecastToggle.addEventListener('click', handleForecastToggle);
    }
    
    if (simulationToggle) {
      simulationToggle.addEventListener('click', handleSimulationToggle);
    }
    
    weatherButtons.forEach(button => {
      button.addEventListener('click', handleWeatherCondition);
    });
    
    if (resetButton) {
      resetButton.addEventListener('click', handleReset);
    }

    if (realTimeToggle) {
      realTimeToggle.addEventListener('click', handleRealTimeToggle);
    }

    if (notificationsBtn) {
      notificationsBtn.addEventListener('click', handleNotificationsClick);
    }

    if (clearNotificationsBtn) {
      clearNotificationsBtn.addEventListener('click', handleClearNotifications);
    }

    if (archiveBtn) {
      archiveBtn.addEventListener('click', handleArchiveClick);
    }

    if (viewHistoricalBtn) {
      viewHistoricalBtn.addEventListener('click', handleViewHistoricalClick);
    }

    if (historicalModalClose) {
      historicalModalClose.addEventListener('click', handleHistoricalModalClose);
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', handleSettingsClick);
    }

    // Add click outside listener to close dropdown
    document.addEventListener('click', handleClickOutside);

    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleCancel);
    }
    
    if (saveAreaBtn) {
      saveAreaBtn.addEventListener('click', handleSave);
    }
    
    // Cleanup
    return () => {
      // Remove risk calculation listeners
      riskInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
          element.removeEventListener('input', handleRiskInputChange);
          element.removeEventListener('change', handleRiskInputChange);
        }
      });

      if (overrideCheckbox) {
        overrideCheckbox.removeEventListener('change', handleOverrideChange);
      }

      if (addMarkerBtn) {
        addMarkerBtn.removeEventListener('click', handleAddMarker);
      }

      if (drawPolygonBtn) {
        drawPolygonBtn.removeEventListener('click', handleDrawPolygon);
      }

      if (iconSizeSlider) {
        iconSizeSlider.removeEventListener('input', handleIconSizeChange);
      }

      if (themeSwitch) {
        themeSwitch.removeEventListener('click', handleThemeToggle);
      }

      if (forecastToggle) {
        forecastToggle.removeEventListener('click', handleForecastToggle);
      }

      if (simulationToggle) {
        simulationToggle.removeEventListener('click', handleSimulationToggle);
      }

      weatherButtons.forEach(button => {
        button.removeEventListener('click', handleWeatherCondition);
      });
      if (resetButton) {
        resetButton.removeEventListener('click', handleReset);
      }

      if (realTimeToggle) {
        realTimeToggle.removeEventListener('click', handleRealTimeToggle);
      }

      if (notificationsBtn) {
        notificationsBtn.removeEventListener('click', handleNotificationsClick);
      }

      if (clearNotificationsBtn) {
        clearNotificationsBtn.removeEventListener('click', handleClearNotifications);
      }

      if (archiveBtn) {
        archiveBtn.removeEventListener('click', handleArchiveClick);
      }

      if (viewHistoricalBtn) {
        viewHistoricalBtn.removeEventListener('click', handleViewHistoricalClick);
      }

      if (historicalModalClose) {
        historicalModalClose.removeEventListener('click', handleHistoricalModalClose);
      }

      if (settingsBtn) {
        settingsBtn.removeEventListener('click', handleSettingsClick);
      }

      // Remove click outside listener
      document.removeEventListener('click', handleClickOutside);

      if (cancelBtn) {
        cancelBtn.removeEventListener('click', handleCancel);
      }

      if (saveAreaBtn) {
        saveAreaBtn.removeEventListener('click', handleSave);
      }
    };
  }, [simulateWeatherCondition, resetSimulation, toggleTheme, runRealTimeSimulation, realTimeSimulationEnabled]);

  // Load saved theme on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      const savedTheme = await firebaseService.loadThemePreference();
      if (savedTheme) {
        const isDark = savedTheme === 'dark';
        setIsDarkMode(isDark);
      
      const body = document.body;
      const themeSwitch = document.getElementById('themeSwitch');
      
        if (isDark) {
          body.classList.remove('light-mode');
          themeSwitch?.classList.remove('active');
        } else {
          body.classList.add('light-mode');
          themeSwitch?.classList.add('active');
        }
      }
    };
    loadThemePreference();
  }, []);

  // Utility function to convert wind direction degrees to cardinal direction
  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  // Flood risk calculation algorithm
  const calculateFloodRisk = React.useCallback((
    elevation: number,
    distanceFromWater: number,
    soilPermeability: string,
    slopeGradient: number,
    drainageCondition: string,
    vegetationCover: string,
    floodHistory: string,
    areaType: string
  ): { level: string, score: number, factors: string[] } => {

    let score = 0;
    const factors: string[] = [];

    // Elevation factor (0-20 points)
    if (elevation <= 2) {
      score += 20;
      factors.push('Very low elevation');
    } else if (elevation <= 5) {
      score += 15;
      factors.push('Low elevation');
    } else if (elevation <= 10) {
      score += 10;
      factors.push('Moderate elevation');
    } else if (elevation <= 20) {
      score += 5;
      factors.push('Higher elevation');
    } else {
      score += 0;
      factors.push('High elevation');
    }

    // Distance from water factor (0-20 points)
    if (distanceFromWater <= 10) {
      score += 20;
      factors.push('Very close to water');
    } else if (distanceFromWater <= 25) {
      score += 15;
      factors.push('Close to water');
    } else if (distanceFromWater <= 50) {
      score += 10;
      factors.push('Moderate distance from water');
    } else if (distanceFromWater <= 100) {
      score += 5;
      factors.push('Far from water');
    } else {
      score += 0;
      factors.push('Very far from water');
    }

    // Soil permeability factor (0-15 points)
    if (soilPermeability === 'low') {
      score += 15;
      factors.push('Low soil permeability');
    } else if (soilPermeability === 'medium') {
      score += 8;
      factors.push('Medium soil permeability');
    } else {
      score += 0;
      factors.push('High soil permeability');
    }

    // Slope gradient factor (0-15 points)
    if (slopeGradient <= 2) {
      score += 15;
      factors.push('Very flat terrain');
    } else if (slopeGradient <= 5) {
      score += 10;
      factors.push('Flat terrain');
    } else if (slopeGradient <= 10) {
      score += 5;
      factors.push('Moderate slope');
    } else if (slopeGradient <= 20) {
      score += 2;
      factors.push('Steep slope');
    } else {
      score += 0;
      factors.push('Very steep slope');
    }

    // Drainage condition factor (0-10 points)
    if (drainageCondition === 'poor') {
      score += 10;
      factors.push('Poor drainage');
    } else if (drainageCondition === 'fair') {
      score += 5;
      factors.push('Fair drainage');
    } else {
      score += 0;
      factors.push('Good drainage');
    }

    // Vegetation cover factor (0-10 points)
    if (vegetationCover === 'low') {
      score += 10;
      factors.push('Low vegetation cover');
    } else if (vegetationCover === 'medium') {
      score += 5;
      factors.push('Medium vegetation cover');
    } else {
      score += 0;
      factors.push('High vegetation cover');
    }

    // Historical flood frequency factor (0-10 points)
    if (floodHistory === 'frequent') {
      score += 10;
      factors.push('Frequent historical flooding');
    } else if (floodHistory === 'occasional') {
      score += 7;
      factors.push('Occasional historical flooding');
    } else if (floodHistory === 'rare') {
      score += 3;
      factors.push('Rare historical flooding');
    } else {
      score += 0;
      factors.push('No historical flooding');
    }

    // Area type adjustment factor (0-5 points)
    if (areaType === 'residential' || areaType === 'single-house') {
      score += 3;
      factors.push('Residential area vulnerability');
    } else if (areaType === 'commercial' || areaType === 'infrastructure') {
      score += 4;
      factors.push('Critical infrastructure');
    } else if (areaType === 'agricultural') {
      score += 2;
      factors.push('Agricultural land');
    }

    // Determine risk level based on total score
    let level: string;
    if (score >= 70) {
      level = 'high';
    } else if (score >= 40) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, score, factors };
  }, []);

  // Update risk calculation display
  const updateRiskCalculation = React.useCallback(() => {
    const elevation = parseFloat((document.getElementById('elevation') as HTMLInputElement)?.value) || 5;
    const distanceFromWater = parseFloat((document.getElementById('distanceFromWater') as HTMLInputElement)?.value) || 50;
    const soilPermeability = (document.getElementById('soilPermeability') as HTMLSelectElement)?.value || 'medium';
    const slopeGradient = parseFloat((document.getElementById('slopeGradient') as HTMLInputElement)?.value) || 2;
    const drainageCondition = (document.getElementById('drainageCondition') as HTMLSelectElement)?.value || 'fair';
    const vegetationCover = (document.getElementById('vegetationCover') as HTMLSelectElement)?.value || 'medium';
    const floodHistory = (document.getElementById('floodHistory') as HTMLSelectElement)?.value || 'rare';
    const areaType = (document.getElementById('areaType') as HTMLSelectElement)?.value || 'residential';

    const result = calculateFloodRisk(
      elevation,
      distanceFromWater,
      soilPermeability,
      slopeGradient,
      drainageCondition,
      vegetationCover,
      floodHistory,
      areaType
    );

    // Update display elements
    const riskLevelEl = document.getElementById('riskLevel');
    const riskScoreEl = document.getElementById('riskScore');
    const riskFactorsEl = document.getElementById('riskFactors');
    const floodRiskSelect = document.getElementById('floodRisk') as HTMLSelectElement;

    if (riskLevelEl) {
      riskLevelEl.textContent = result.level.charAt(0).toUpperCase() + result.level.slice(1);
      riskLevelEl.className = `risk-level ${result.level}-risk`;
    }

    if (riskScoreEl) {
      riskScoreEl.textContent = `Risk Score: ${result.score}/100`;
    }

    if (riskFactorsEl) {
      riskFactorsEl.textContent = `Key Factors: ${result.factors.join(', ')}`;
    }

    // Auto-set the flood risk select if not manually overridden
    const overrideCheckbox = document.getElementById('overrideRisk') as HTMLInputElement;
    if (floodRiskSelect && (!overrideCheckbox || !overrideCheckbox.checked)) {
      floodRiskSelect.value = result.level;
    }
  }, [calculateFloodRisk]);

  // This component doesn't render anything visible - it just manages the map and weather data
  return (
    <>
      <FloodEventFormModal
        isOpen={isFloodEventFormModalOpen}
        onClose={() => setIsFloodEventFormModalOpen(false)}
        area={selectedAreaForFloodReport}
        firebaseService={firebaseService}
      />
    </>
  );
};

export default App;