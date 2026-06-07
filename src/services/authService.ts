import { SignupPayload, StoredUserAccount, User } from '../models/User';
import { getItem, setItem, STORAGE_KEYS } from './storageService';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function hashPassword(password: string, userId: string): string {
  const input = `${userId}:${password}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash.toString(16);
}

async function getAccounts(): Promise<StoredUserAccount[]> {
  return (await getItem<StoredUserAccount[]>(STORAGE_KEYS.USERS)) ?? [];
}

async function saveAccounts(accounts: StoredUserAccount[]): Promise<void> {
  await setItem(STORAGE_KEYS.USERS, accounts);
}

export async function registerAccount(payload: SignupPayload): Promise<User> {
  const emailKey = normalize(payload.email);
  const usernameKey = normalize(payload.username);

  if (!emailKey || !usernameKey || !payload.password) {
    throw new Error('Username, email, and password are required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey)) {
    throw new Error('Enter a valid email address.');
  }

  if (payload.password !== payload.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  if (payload.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const accounts = await getAccounts();
  if (accounts.some(account => account.emailKey === emailKey)) {
    throw new Error('An account with this email already exists.');
  }

  if (accounts.some(account => account.usernameKey === usernameKey)) {
    throw new Error('This username is already taken.');
  }

  const user: User = {
    id: generateId(),
    email: emailKey,
    username: payload.username.trim(),
    displayName: payload.username.trim(),
    isEmailVerified: false,
    createdAt: new Date().toISOString(),
  };

  const account: StoredUserAccount = {
    user,
    emailKey,
    usernameKey,
    passwordHash: hashPassword(payload.password, user.id),
  };

  await saveAccounts([...accounts, account]);
  return user;
}

export async function authenticateAccount(
  identifier: string,
  password: string,
): Promise<User> {
  const identifierKey = normalize(identifier);
  if (!identifierKey || !password) {
    throw new Error('Email/username and password are required.');
  }

  const accounts = await getAccounts();
  const account = accounts.find(
    item => item.emailKey === identifierKey || item.usernameKey === identifierKey,
  );

  if (!account || account.passwordHash !== hashPassword(password, account.user.id)) {
    throw new Error('Invalid email/username or password.');
  }

  return account.user;
}

export async function accountExists(identifier: string): Promise<boolean> {
  const identifierKey = normalize(identifier);
  const accounts = await getAccounts();

  return accounts.some(
    account => account.emailKey === identifierKey || account.usernameKey === identifierKey,
  );
}
