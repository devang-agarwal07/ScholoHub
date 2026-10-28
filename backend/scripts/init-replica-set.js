// Run using mongosh. Shared by Docker Compose and CI.
const host = process.env.MONGO_RS_HOST || 'mongodb:27017';
try {
  const status = rs.status();
  if (status.set !== 'rs0') throw new Error('Expected replica set rs0.');
} catch (error) {
  if (error.code !== 94) throw error;
  const result = rs.initiate({ _id: 'rs0', members: [{ _id: 0, host }] });
  if (!result.ok) throw new Error(JSON.stringify(result));
}
for (let attempt = 0; attempt < 60; attempt++) {
  if (db.hello().isWritablePrimary) {
    print('MongoDB replica set rs0 is ready.');
    quit(0);
  }
  sleep(500);
}
throw new Error('MongoDB did not elect a primary within 30 seconds.');
