const bcrypt = require('bcryptjs');

async function generarHash() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log(hash);
}

generarHash();
