// This script runs only on first container init (empty data dir)
// It creates the application user for the sv-app database.

(function () {
	try {
		var dbName = 'sv-app';
		var user = 'local-user';
		var pwd = '1234567890';

		var appdb = db.getSiblingDB(dbName);
		appdb.createUser({
			user: user,
			pwd: pwd,
			roles: [{ role: 'readWrite', db: dbName }]
		});

		print('Created user ' + user + ' with readWrite on ' + dbName);
	} catch (e) {
		print('User creation script error: ' + e);
	}
})();
