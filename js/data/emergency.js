// Numéros d'urgence par pays (à vérifier avant le départ) + conseils grossesse.
const EU = { general: '112', police: '112', ambulance: '112', fire: '112' };

export const EMERGENCY = {
  FR: { ...EU, ambulance: '15', police: '17', fire: '18', extra: [['SOS Médecins', '3624']] },
  GB: {
    general: '999', police: '999', ambulance: '999', fire: '999',
    extra: [['NHS 111 (conseil médical 24h/24, non urgent)', '111'], ['112 fonctionne aussi', '112']],
    tips: [
      'Urgence vitale : 999 (ou 112). Conseil médical non urgent : NHS 111, 24h/24.',
      'La carte européenne d\'assurance maladie (CEAM) reste acceptée au Royaume-Uni pour les soins médicalement nécessaires : emportez celles de toute la famille.',
      'Les pharmacies (« chemists », ex. Boots) donnent des conseils sans rendez-vous.',
      'Ambassade de France à Londres : +44 20 7073 1000.',
    ],
  },
  ES: { ...EU, extra: [['Urgences sanitaires', '061']] },
  IT: { ...EU, extra: [['Ambulance', '118']] },
  DE: { ...EU, police: '110', extra: [['Médecin de garde', '116117']] },
  BE: { ...EU, police: '101' },
  CH: { general: '112', police: '117', ambulance: '144', fire: '118' },
  PT: EU, NL: EU, AT: EU, IE: { ...EU, extra: [['Aussi', '999']] }, GR: EU, HR: EU, DK: EU, SE: EU, NO: { ...EU, police: '112', ambulance: '113' },
  US: { general: '911', police: '911', ambulance: '911', fire: '911' },
  CA: { general: '911', police: '911', ambulance: '911', fire: '911' },
};

export const emergencyFor = (cc) => EMERGENCY[cc] || EU;

export const PREGNANCY_TIPS = [
  'Gardez le carnet de maternité / dernier compte rendu d\'échographie dans le coffre-fort de l\'app.',
  'Consultez sans attendre en cas de saignement, de douleurs ou contractions, de fièvre, ou si vous sentez moins bouger le bébé (à partir du 2e trimestre).',
  'Buvez régulièrement, levez-vous et marchez toutes les heures dans les transports.',
  'Une pause repos chaque après-midi est prévue dans le planning.',
];
