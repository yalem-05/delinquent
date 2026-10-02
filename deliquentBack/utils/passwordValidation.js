const bcrypt = require("bcryptjs");

const DEFAULT_PASSWORD = "12345678";

function validateComplexPassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, msg: "Password is required." };
  }
  if (password === DEFAULT_PASSWORD) {
    return { valid: false, msg: "Password cannot be the default password." };
  }
  if (password.length < 8) {
    return { valid: false, msg: "Password must be at least 8 characters." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, msg: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, msg: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, msg: "Password must contain at least one number." };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, msg: "Password must contain at least one special character." };
  }
  return { valid: true };
}

async function isDefaultPassword(user) {
  if (!user?.password) return false;
  return bcrypt.compare(DEFAULT_PASSWORD, user.password);
}

module.exports = { DEFAULT_PASSWORD, validateComplexPassword, isDefaultPassword };
