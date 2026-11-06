// « Ouvert maintenant » à partir des horaires OpenStreetMap (chargé à la demande : bibliothèque lourde).
let OH = null;
export async function loadOpeningHours() {
  if (!OH) OH = (await import('../../vendor/opening_hours.js')).default;
  return OH;
}

// null = inconnu, true/false sinon. Appeler loadOpeningHours() avant.
export function isOpenNow(place, countryCode) {
  const oh = place?.tags?.opening_hours;
  if (!oh || !OH) return null;
  try {
    const parser = new OH(oh, {
      lat: place.lat,
      lon: place.lon,
      address: { country_code: (countryCode || 'fr').toLowerCase(), state: '' },
    });
    return parser.getState(new Date());
  } catch {
    return null;
  }
}
