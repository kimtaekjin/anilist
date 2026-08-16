const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function validateUsername(value) {
  if (typeof value !== "string") return false;
  const username = value.trim();
  return username.length >= 2 && username.length <= 30 && /^[\p{L}\p{N}_-]+$/u.test(username);
}

export function validatePassword(value) {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 72 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value)
  );
}
