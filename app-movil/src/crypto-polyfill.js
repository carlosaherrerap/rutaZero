// Polyfill global.crypto.getRandomValues for CryptoJS in React Native / Expo Go
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function (array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}
console.log('🔒 [Crypto-Polyfill] global.crypto.getRandomValues inicializado.');
