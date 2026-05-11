const bcrypt = require('bcryptjs');
const pw = 'ruta123';
bcrypt.hash(pw, 10).then(hash => {
    console.log(hash);
});
