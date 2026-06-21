import { connectDB, db } from './models.js';

async function runTests() {
  console.log("Starting GoaSip Backend Sanity Tests...");
  
  // 1. Trigger DB Connection
  const isMongo = await connectDB(process.env.MONGODB_URI || '');
  console.log(`Database initialized. Using MongoDB: ${isMongo ? 'YES' : 'NO (JSON Fallback)'}`);

  try {
    // 2. Test reading stores
    const stores = await db.getStores();
    console.log(`[PASS] Read stores successfully. Count: ${stores.length}`);
    if (stores.length > 0) {
      console.log(`       First store: ${stores[0].name} (${stores[0].address})`);
    } else {
      throw new Error("Seed stores not found!");
    }

    // 3. Test reading default customer
    const customer = await db.getUserByPhone('+919876543210');
    if (customer && customer.role === 'customer') {
      console.log(`[PASS] Found test customer: ${customer.name}`);
      console.log(`       KYC Status: ${customer.kyc?.status}`);
    } else {
      throw new Error("Default test customer not found!");
    }

    // 4. Test creating a temporary user
    const testPhone = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
    const tempUser = await db.createUser({
      phone: testPhone,
      name: "Temporary Tester",
      email: "tester@goasip.com",
      dob: "1998-05-20",
      role: "customer",
      isVerified: true
    });
    console.log(`[PASS] Created temporary test user with ID: ${tempUser.id}`);

    // Cleanup temp user in JSON db
    if (!isMongo) {
      const fs = await import('fs');
      const dbPath = './backend/db.json';
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      data.users = data.users.filter(u => u.id !== tempUser.id);
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
      console.log(`[PASS] Cleaned up temporary test user.`);
    }

    console.log("\n=============================================");
    console.log("ALL GOASIP BACKEND SANITY TESTS PASSED!");
    console.log("=============================================\n");
    process.exit(0);

  } catch (err) {
    console.error("\n=============================================");
    console.error("GOASIP BACKEND SANITY TEST FAILED:");
    console.error(err.message);
    console.error("=============================================\n");
    process.exit(1);
  }
}

runTests();
