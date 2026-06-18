export const getAvatarUrl = (name, id) => {
  if (!name) return `https://randomuser.me/api/portraits/lego/${(id?.charCodeAt(0) || 1) % 10}.jpg`;
  
  const firstName = name.trim().split(' ')[0].toLowerCase();
  
  // Basic heuristic for Spanish names
  let isFemale = firstName.endsWith('a') || firstName.endsWith('is') || firstName.endsWith('in');
  
  // Exceptions
  const maleExceptions = ['luca', 'josua', 'andrea', 'mika', 'nikita'];
  const femaleExceptions = ['carmen', 'isabel', 'rut', 'ruth', 'maribel', 'beatriz', 'luz', 'pilar', 'sol', 'raquel', 'flor', 'belen', 'miriam', 'inés', 'margarita'];

  if (maleExceptions.includes(firstName)) isFemale = false;
  if (femaleExceptions.includes(firstName)) isFemale = true;

  // Use the ID to get a deterministic random number between 0 and 99
  let num = 0;
  if (id) {
    const idStr = String(id);
    num = (idStr.charCodeAt(0) + idStr.charCodeAt(idStr.length-1) + idStr.length) % 100;
  } else {
    num = (firstName.charCodeAt(0) + firstName.charCodeAt(firstName.length-1)) % 100;
  }

  return `https://randomuser.me/api/portraits/${isFemale ? 'women' : 'men'}/${num}.jpg`;
};
