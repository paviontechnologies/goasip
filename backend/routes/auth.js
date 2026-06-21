import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../models.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'goasip_premium_secret_key';

// Keep track of active OTPs in memory for the sandbox demo
const otpStorage = new Map();

// Helper to calculate age from DOB string (YYYY-MM-DD)
const calculateAge = (dobString) => {
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// 1. Send OTP (Simulated SMS gateway)
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required." });
  }

  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStorage.set(phone, {
    otp,
    expires: Date.now() + 5 * 60 * 1000 // 5 minutes expiration
  });

  // Log in server console (simulating SMS gateway dispatch)
  console.log(`\n=============================================`);
  console.log(`[SMS GATEWAY] OTP sent to ${phone}: ${otp}`);
  console.log(`=============================================\n`);

  // Return the OTP in response ONLY for the sandbox/demo version so the user can see it!
  res.json({
    success: true,
    message: "OTP sent successfully (Simulated). Check server logs or use the sandbox OTP below.",
    otp: otp // Exposed for convenience in the demo UI
  });
});

// 2. Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: "Phone and OTP are required." });
  }

  const record = otpStorage.get(phone);
  if (!record) {
    return res.status(400).json({ success: false, message: "OTP not requested or expired." });
  }

  if (record.expires < Date.now()) {
    otpStorage.delete(phone);
    return res.status(400).json({ success: false, message: "OTP has expired." });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP code." });
  }

  // OTP verified successfully, remove it from storage
  otpStorage.delete(phone);

  // Check if user already exists
  const existingUser = await db.getUserByPhone(phone);
  if (!existingUser) {
    // Return that they need to register/complete profile
    return res.json({
      success: true,
      newUser: true,
      message: "Phone verified. Please complete registration.",
      phone
    });
  }

  // User exists, generate JWT token
  const token = jwt.sign(
    { id: existingUser.id, phone: existingUser.phone, role: existingUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    newUser: false,
    token,
    user: existingUser
  });
});

// 3. Register New User
router.post('/register', async (req, res) => {
  const { phone, name, email, dob, role } = req.body;
  
  if (!phone || !name || !email || !dob) {
    return res.status(400).json({ success: false, message: "All fields (phone, name, email, dob) are required." });
  }

  // 1. Age check (Goa excise law: must be 21+ to buy/sell alcohol)
  const age = calculateAge(dob);
  if (age < 21) {
    return res.status(400).json({
      success: false,
      message: `Age verification failed. You must be 21 years or older to order liquor in Goa (Your age: ${age}).`
    });
  }

  // 2. Check if phone already registered
  const existingUser = await db.getUserByPhone(phone);
  if (existingUser) {
    return res.status(400).json({ success: false, message: "Phone number already registered." });
  }

  // 3. Create user in database
  const userRole = role || 'customer'; // Default is customer
  const newUser = await db.createUser({
    phone,
    name,
    email,
    dob,
    role: userRole,
    isVerified: true,
    storeId: userRole === 'vendor' ? `s-${Date.now()}` : undefined, // Assign mock storeId to new vendors
    kyc: {
      status: userRole === 'customer' ? 'none' : 'verified', // Vendor starts verified for demo simplicity
      documentType: '',
      documentNumber: ''
    }
  });

  // Generate JWT token
  const token = jwt.sign(
    { id: newUser.id, phone: newUser.phone, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    user: newUser
  });
});

// 4. KYC / ID verification endpoint
router.post('/kyc-verify', async (req, res) => {
  const { userId, documentType, documentNumber, dob } = req.body;

  if (!userId || !documentType || !documentNumber || !dob) {
    return res.status(400).json({ success: false, message: "Missing KYC details." });
  }

  // Verify age from birthdate sent in KYC matches 21+ rule
  const age = calculateAge(dob);
  if (age < 21) {
    return res.status(400).json({
      success: false,
      message: `KYC Failed. Document details indicate age is ${age}, which is under the 21+ legal drinking age limit in Goa.`
    });
  }

  const updatedUser = await db.updateUser(userId, {
    dob, // Update DOB to match official document
    kyc: {
      status: 'verified',
      documentType,
      documentNumber: documentNumber.replace(/\d(?=\d{4})/g, "X") // Mask ID numbers for safety
    }
  });

  if (!updatedUser) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  res.json({
    success: true,
    message: "KYC document verified successfully.",
    user: updatedUser
  });
});

export default router;
export { JWT_SECRET };
