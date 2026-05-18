const fs = require('node:fs');

module.exports = async () => {
  const statePath = process.env.JEST_DB_STATE_PATH;
  if (!statePath) return;

  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(raw);

    if (state?.dbFile) {
      try {
        fs.rmSync(state.dbFile, { force: true });
      } catch {
        // ignore
      }
    }

    try {
      fs.rmSync(statePath, { force: true });
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
};
