// Fenêtres (feuilles d'actions, confirmations, toasts) sans dépendance.
let host = null;
export function setDialogHost(fn) {
  host = fn;
}

// options : [{ label, value, danger }]. Renvoie la valeur choisie ou null.
export function actionSheet(title, message, options) {
  return new Promise((resolve) => {
    host?.({ title, message, options, resolve });
  });
}

export async function confirm(title, message, okLabel = 'Confirmer', danger = true) {
  const v = await actionSheet(title, message, [{ label: okLabel, value: true, danger }]);
  return v === true;
}

let toastTimer = null;
export function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = 'none'), 2600);
}
