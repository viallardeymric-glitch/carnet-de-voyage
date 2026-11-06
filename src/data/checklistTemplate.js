// Check-list pré-remplie pour une famille avec un enfant de 5 ans et une grossesse.
export function checklistTemplate(countryCode) {
  const items = [
    ['Papiers', 'Pièces d\'identité ou passeports valides (toute la famille)'],
    ['Papiers', 'Cartes européennes d\'assurance maladie (CEAM) x3'],
    ['Papiers', 'Attestation d\'assurance voyage / assistance'],
    ['Papiers', 'Billets et réservations importés dans le coffre-fort'],
    ['Grossesse', 'Carnet de maternité + dernière échographie'],
    ['Grossesse', 'Ordonnances et traitements en cours (fer, vitamines…)'],
    ['Grossesse', 'Bas de contention pour les trajets'],
    ['Grossesse', 'Coussin de voyage / ceinture de grossesse'],
    ['Grossesse', 'Certificat médical de non contre-indication (si avion)'],
    ['Enfant', 'Doudou et objets repères du coucher'],
    ['Enfant', 'Paracétamol enfant + thermomètre + pansements'],
    ['Enfant', 'Carnet de santé de l\'enfant'],
    ['Enfant', 'Activités pour les trajets (livres, jeux, casque)'],
    ['Enfant', 'Bracelet avec numéro de téléphone des parents'],
    ['Enfant', 'Collations et gourde'],
    ['Vêtements', 'Tenues en couches + vêtements de pluie'],
    ['Vêtements', 'Chaussures confortables déjà portées'],
    ['Pratique', 'Chargeurs + batterie externe'],
    ['Pratique', 'Carte bancaire sans frais à l\'étranger'],
    ['Pratique', 'Télécharger la zone de carte hors-ligne (Plans / Google Maps)'],
  ];
  if (countryCode === 'GB') {
    items.unshift(
      ['Papiers', 'PASSEPORTS obligatoires pour le Royaume-Uni (la carte d\'identité ne suffit plus), enfant compris'],
      ['Papiers', 'ETA (autorisation électronique de voyage UK) pour chacun, enfant compris, via l\'app officielle « UK ETA »'],
    );
    items.push(
      ['Pratique', 'Adaptateurs prise britannique (type G) x2'],
      ['Pratique', 'Carte bancaire sans contact pour le métro (paiement direct, l\'enfant de 5 ans voyage gratuitement)'],
    );
  }
  return items.map(([section, label], i) => ({ section, label, done: false, order: i }));
}
