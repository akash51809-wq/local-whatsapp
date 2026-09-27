const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const { User } = require('../auth');

const hashPassword = async (password, salt = crypto.randomBytes(16).toString('hex')) => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (err, key) => err ? reject(err) : resolve(`scrypt$${salt}$${key.toString('hex')}`));
  });
};

const generateApiToken = () => {
  return 'wa_' + crypto.randomBytes(24).toString('hex');
};

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const target = process.argv[2] || 'admin';
  const newPassword = process.argv[3] || '123456';

  let user = await User.findOne({
    $or: [
      { username: target },
      { mobile: target },
      { userId: target }
    ]
  });

  if (!user) {
    console.log(`User "${target}" does not exist. Creating new user account...`);
    const expires = new Date();
    expires.setDate(expires.getDate() + 30); // 30 days validity

    user = new User({
      userId: 'USR' + target.slice(-8),
      username: target,
      mobile: target,
      name: 'User ' + target,
      passwordHash: await hashPassword(newPassword),
      apiToken: generateApiToken(),
      role: 'user',
      plan: 'Professional',
      planExpiresAt: expires,
      status: 'active'
    });
    await user.save();
    console.log(`SUCCESS: Created user "${user.username}" with password: ${newPassword}`);
  } else {
    console.log(`Found existing user: ${user.username} (userId: ${user.userId})`);
    user.passwordHash = await hashPassword(newPassword);
    user.status = 'active';
    await user.save();
    console.log(`SUCCESS: Password for user "${user.username}" reset to: ${newPassword}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
