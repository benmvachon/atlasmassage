import { useEffect, useRef, useState } from 'react';

// Rough approximation of a 20-minute peak-traffic drive radius. This is a
// visual stand-in only — the booking modal's actual range check calls the
// Distance Matrix API for a real drive-time answer.
const SERVICE_RADIUS_METERS = 14500; // ~9 miles

// Mirrors $color-secondary in styles/abstracts/_variables.scss — Maps JS can't
// read SCSS variables, so this is kept in sync by hand.
const SERVICE_AREA_COLOR = '#dd9955';

// Desaturates the base map tiles only; overlays like Circle draw in a
// separate pane and keep their own colors.
const GRAYSCALE_MAP_STYLE = [{ stylers: [{ saturation: -100 }] }];

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let mapsApiPromise = null;

function loadMapsApi() {
  if (mapsApiPromise) return mapsApiPromise;
  mapsApiPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return mapsApiPromise;
}

function addressString(contact) {
  return [contact.address_line1, contact.address_line2, contact.city, `${contact.state} ${contact.zip}`]
    .filter(Boolean)
    .join(', ');
}

function PinFallback({ contact }) {
  const mapQuery = encodeURIComponent(addressString(contact));
  return (
    <>
      <iframe
        title="Atlas Bodywork service area"
        src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=11&ie=UTF8&iwloc=&output=embed`}
        width="100%"
        height="420"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="location-section__map-caption">
        We travel to you anywhere within a 20-minute drive of our service area at peak traffic.
      </p>
    </>
  );
}

export default function ServiceAreaMap({ contact }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!API_KEY || !contact) return;

    let cancelled = false;

    loadMapsApi()
      .then(maps => {
        if (cancelled || !containerRef.current) return;
        const geocoder = new maps.Geocoder();
        geocoder.geocode({ address: addressString(contact) }, (results, status) => {
          if (cancelled) return;
          if (status !== 'OK' || !results[0]) {
            setFailed(true);
            return;
          }
          const center = results[0].geometry.location;
          const map = new maps.Map(containerRef.current, {
            center,
            zoom: 11,
            disableDefaultUI: true,
            zoomControl: true,
            styles: GRAYSCALE_MAP_STYLE,
          });
          new maps.Circle({
            map,
            center,
            radius: SERVICE_RADIUS_METERS,
            strokeColor: SERVICE_AREA_COLOR,
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor: SERVICE_AREA_COLOR,
            fillOpacity: 0.12,
          });
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [contact]);

  if (!API_KEY || failed || !contact) {
    return <PinFallback contact={contact} />;
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: 420 }} />
      <p className="location-section__map-caption">
        We travel to you anywhere within a 20-minute drive.
      </p>
    </>
  );
}
