// Point d'entrée : configuration → profil → connexion → code PIN → verrou → voyage → onglets.
import { useSharedKeys } from './core/sharedKeys.js';
import { html, render, useState, useEffect, useMemo } from '../vendor/preact.js';
import { initStore, auth, fb, useDoc } from './core/store.js';
import { ls, getMembers, consumeInvite, watchAppearance } from './core/config.js';
import { hasPin, watchAutoLock } from './core/lock.js';
import { persistStorage } from './core/vault.js';
import { AppCtx, TABS, currentRoute, back, useApp } from './core/app.js';
import { DialogHost, Icon, Spinner } from './ui/components.js';
import { toast } from './ui/dialogs.js';

import WelcomeView from './views/WelcomeView.js';
import LoginView from './views/LoginView.js';
import PinSetupView from './views/PinSetupView.js';
import LockView from './views/LockView.js';
import TripsView from './views/TripsView.js';
import MapView from './views/MapView.js';
import PlaceView from './views/PlaceView.js';
import PlannerView from './views/PlannerView.js';
import VaultView from './views/VaultView.js';
import BudgetView from './views/BudgetView.js';
import MoreView from './views/MoreView.js';
import ChecklistView from './views/ChecklistView.js';
import EmergencyView from './views/EmergencyView.js';
import JournalView from './views/JournalView.js';
import AssistantView from './views/AssistantView.js';
import SettingsView from './views/SettingsView.js';
import TravelersView from './views/TravelersView.js';

const SCREENS = {
  carte: { view: MapView, title: (t) => t?.city?.name || 'Carte' },
  planning: { view: PlannerView, title: () => 'Planning' },
  coffre: { view: VaultView, title: () => 'Coffre-fort' },
  budget: { view: BudgetView, title: () => 'Budget' },
  plus: { view: MoreView, title: () => 'Plus' },
  lieu: { view: PlaceView, title: () => 'Lieu', sub: true },
  voyages: { view: TripsView, title: () => 'Mes voyages', sub: true },
  checklist: { view: ChecklistView, title: () => 'Check-list', sub: true },
  urgences: { view: EmergencyView, title: () => 'Urgences & santé', sub: true },
  journal: { view: JournalView, title: () => 'Journal de bord', sub: true },
  assistant: { view: AssistantView, title: () => 'Assistant', sub: true },
  voyageurs: { view: TravelersView, title: () => 'Voyageurs', sub: true },
  reglages: { view: SettingsView, title: () => 'Réglages', sub: true },
};

function App({ mode }) {
  const [memberId, setMemberIdState] = useState(ls.get('memberId'));
  const [members, setMembersState] = useState(getMembers());
  const [user, setUser] = useState(mode === 'firebase' ? undefined : null);
  const [pinOk, setPinOk] = useState(hasPin());
  const [locked, setLocked] = useState(hasPin());
  const [tripId, setTripIdState] = useState(ls.get('tripId'));
  const [route, setRoute] = useState(currentRoute());
  const trip = useDoc(tripId && (mode === 'local' || user) ? `trips/${tripId}` : null);
  useSharedKeys(mode, user, tripId);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    persistStorage();
    const stop = watchAutoLock(() => hasPin() && setLocked(true));
    let unsub = null;
    if (mode === 'firebase') unsub = fb.onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => {
      window.removeEventListener('hashchange', onHash);
      stop();
      unsub?.();
    };
  }, []);

  const ctx = useMemo(
    () => ({
      mode,
      user,
      members,
      memberId,
      member: memberId ? members[memberId] : null,
      setMemberId: (id) => {
        ls.set('memberId', id);
        setMemberIdState(id);
      },
      refreshMembers: () => setMembersState(getMembers()),
      tripId,
      trip,
      setTripId: (id) => {
        ls.set('tripId', id);
        setTripIdState(id);
      },
      path: (sub) => (tripId ? `trips/${tripId}/${sub}` : null),
      lock: () => setLocked(true),
      unlock: () => setLocked(false),
      pinChanged: () => {
        setPinOk(hasPin());
        setLocked(false);
      },
      logout: async () => {
        if (mode === 'firebase') await fb.signOut(auth);
      },
    }),
    [mode, user, members, memberId, tripId, trip]
  );

  let screen;
  if (!memberId) screen = html`<${WelcomeView} />`;
  else if (mode === 'firebase' && user === undefined) screen = html`<${Spinner} />`;
  else if (mode === 'firebase' && !user) screen = html`<${LoginView} />`;
  else if (!pinOk) screen = html`<${PinSetupView} />`;
  else if (locked) screen = html`<${LockView} />`;
  else if (!tripId || route === 'voyages') screen = html`<${Shell} route="voyages" />`;
  else screen = html`<${Shell} route=${SCREENS[route] ? route : 'carte'} />`;

  return html`<${AppCtx.Provider} value=${ctx}>${screen}<${DialogHost} /></${AppCtx.Provider}>`;
}

function Shell({ route }) {
  const { trip, tripId } = useApp();
  const s = SCREENS[route];
  const View = s.view;
  const showTabs = !!tripId;
  return html`
    <header class="header">
      ${s.sub && tripId ? html`<button class="back" onClick=${back} aria-label="Retour"><${Icon} name="chevron-left" /></button>` : null}
      <h1>${s.title(trip)}</h1>
    </header>
    <main class="content" key=${route}><${View} /></main>
    ${showTabs
      ? html`<nav class="tabbar">
          ${TABS.map(
            (t) => html`<button class=${route === t.id ? 'active' : ''} onClick=${() => (location.hash = `#/${t.id}`)}>
              <${Icon} name=${t.icon} />${t.label}
            </button>`
          )}
        </nav>`
      : null}
  `;
}

// Démarrage
(async () => {
  watchAppearance();
  if (consumeInvite()) setTimeout(() => toast('Configuration de synchronisation reçue ✓'), 600);
  let mode;
  try {
    mode = await initStore();
  } catch (e) {
    console.error(e);
    mode = 'local';
  }
  render(html`<${App} mode=${mode} />`, document.getElementById('app'));
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

