import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function TrackingMap({
  storeLocation,
  deliveryLocation,
  driverLocation,
  routePoints = [],
  zoom = 13
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const storeMarker = useRef(null);
  const customerMarker = useRef(null);
  const driverMarker = useRef(null);
  const polylineRoute = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Use store location, driver location, or default to Panaji, Goa
    const centerLat = storeLocation?.lat || 15.4909;
    const centerLng = storeLocation?.lng || 73.8278;

    mapInstance.current = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: true,
      attributionControl: false
    });

    // Load CartoDB Dark Matter tiles (premium dark mode tiles)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update Elements when positions change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // 1. Store Marker
    if (storeLocation?.lat && storeLocation?.lng) {
      const storeIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-gold-500 border-2 border-black text-black shadow-lg shadow-gold-500/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      if (storeMarker.current) {
        storeMarker.current.setLatLng([storeLocation.lat, storeLocation.lng]);
      } else {
        storeMarker.current = L.marker([storeLocation.lat, storeLocation.lng], { icon: storeIcon })
          .addTo(map)
          .bindPopup("<strong class='text-gold-500'>Store House</strong><br>Preparing Liquor Stock");
      }
    }

    // 2. Customer Delivery Location Marker
    if (deliveryLocation?.lat && deliveryLocation?.lng) {
      const customerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gold-500 text-black shadow-lg shadow-white/50 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32] // Anchored at bottom center
      });

      if (customerMarker.current) {
        customerMarker.current.setLatLng([deliveryLocation.lat, deliveryLocation.lng]);
      } else {
        customerMarker.current = L.marker([deliveryLocation.lat, deliveryLocation.lng], { icon: customerIcon })
          .addTo(map)
          .bindPopup("<strong class='text-gold-500'>Delivery Location</strong><br>North Goa Residence");
      }
    }

    // 3. Polyline Route Draw
    if (routePoints && routePoints.length > 0) {
      const latLngs = routePoints.map(p => [p.lat, p.lng]);
      
      if (polylineRoute.current) {
        polylineRoute.current.setLatLngs(latLngs);
      } else {
        polylineRoute.current = L.polyline(latLngs, {
          color: '#d49a2e',
          weight: 4,
          opacity: 0.8,
          dashArray: '5, 8'
        }).addTo(map);
      }
    }

    // 4. Driver Marker
    if (driverLocation?.lat && driverLocation?.lng) {
      const driverIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="flex items-center justify-center w-9 h-9 rounded-full bg-gold-500 text-black border-2 border-black shadow-lg shadow-gold-500/80 ring-2 ring-gold-300 ring-offset-1 ring-offset-dark-bg">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      if (driverMarker.current) {
        driverMarker.current.setLatLng([driverLocation.lat, driverLocation.lng]);
      } else {
        driverMarker.current = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
          .addTo(map)
          .bindPopup("<strong class='text-gold-500'>GoaSip Partner</strong><br>Delivering Spirits");
      }
    }

    // Adjust Map bounds to show all markers
    const group = [];
    if (storeMarker.current) group.push(storeMarker.current.getLatLng());
    if (customerMarker.current) group.push(customerMarker.current.getLatLng());
    if (driverMarker.current) group.push(driverMarker.current.getLatLng());

    if (group.length > 1) {
      map.fitBounds(L.latLngBounds(group), { padding: [50, 50] });
    } else if (group.length === 1) {
      map.setView(group[0], zoom);
    }

  }, [storeLocation, deliveryLocation, driverLocation, routePoints]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-dark-border shadow-2xl">
      {/* Map Target Element */}
      <div ref={mapRef} className="w-full h-full z-10" />

      {/* Floating Status overlay */}
      {driverLocation && (
        <div className="absolute bottom-4 left-4 z-20 bg-dark-card border border-gold-500/30 px-3 py-2 rounded-lg text-xs flex items-center gap-2 shadow-lg backdrop-blur-md">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
          <span className="font-semibold text-gold-300">Live GPS Connected</span>
        </div>
      )}
    </div>
  );
}
