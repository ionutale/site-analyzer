// This script runs only on first container init (empty data dir)
// It creates the application user for the sv-app database.

try {
  const dbName = process.env.MONGO_INITDB_DATABASE || 'sv-app';
  const user = 'local-user';
  const pwd = '1234567890';

  const db = db.getSiblingDB(dbName);
  db.createUser({
    user,
    pwd,
    roles: [{ role: 'readWrite', db: dbName }]
  });

  print(`Created user ${user} with readWrite on ${dbName}`);
} catch (e) {
  print(`User creation script error: ${e}`);
}
