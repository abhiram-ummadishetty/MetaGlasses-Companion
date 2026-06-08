import { dbAdmin } from '../src/integrations/localdb/client.server.js';

// Importing the module triggers DB initialization. Use a no-op to keep the process alive briefly.
console.log('Initializing local JSON DB...');
setTimeout(() => console.log('done'), 100);
