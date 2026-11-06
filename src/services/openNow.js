// « Ouvert maintenant » à partir des horaires OpenStreetMap (opening_hours).
import OpeningHours from 'opening_hours';

export function isOpenNow(place, countryCode) {
  const oh = place?.tags?.opening_hours;
  if (!oh) return null; // inconnu
  try {
    const parser = new OpeningHours(oh, {
      lat: place.lat,
      lon: place.lon,
      address: { country_code: (countryCode || 'fr').toLowerCase(), state: '' },
    });
    return parser.getState(new Date());
  } catch {
    return null;
  }
}
