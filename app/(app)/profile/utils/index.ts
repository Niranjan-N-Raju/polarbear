export function validateProfilePassword(currentPassword: string, newPassword: string, confirmPassword: string): string | null {
  if (!currentPassword.trim()) return "Current password is required.";
  if (!newPassword.trim()) return "New password is required.";
  if (!confirmPassword.trim()) return "Confirm password is required.";
  if (newPassword !== confirmPassword) return "Passwords do not match.";
  if (newPassword.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(newPassword)) return "Password must contain at least 1 uppercase letter.";
  if (!/[^A-Za-z0-9]/.test(newPassword)) return "Password must contain at least 1 special character.";
  if (!/\d/.test(newPassword)) return "Password must contain at least 1 number.";
  if (currentPassword === newPassword) return "New password cannot be the same as your current password.";
  return null;
}
