import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureFromUrl } from '../services/attribution.js';

// Invisible component: captures UTM params from the URL on initial load and on every
// navigation, so email/ad deep-links to any route are recorded before the user books.
export default function AttributionTracker() {
  const location = useLocation();
  useEffect(() => {
    captureFromUrl(location.search);
  }, [location.search]);
  return null;
}
