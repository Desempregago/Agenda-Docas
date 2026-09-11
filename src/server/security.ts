import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SystemUserRole } from '../types';
import { StorageService } from './storage';

export type SessionPrincipal =
  | { type: 'system'; userId: string; username: string; role: SystemUserRole }
  | { type: 'supplier'; supplierCnpj: string; supplierName: string };

type SessionPayload = SessionPrincipal & { iat: number; exp: number };

const SESSION_COOKIE = 'agenda_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Resolve a persistent session secret:
 * 1. Explicit env var process.env.SESSION_SECRET (highest priority)
 * 2. Or a locally generated file-based secret (data/.session_secret) so it never hardcodes
 *    a shared secret into git while maintaining session persistence across server restarts.
 */
export type SessionSecretSource = 'env' | 'file' | 'memory';

function resolveSessionSecret(): { secret: string; source: SessionSecretSource } {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length > 0) {
    return { secret: process.env.SESSION_SECRET.trim(), source: 'env' };
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const secretPath = path.join(dataDir, '.session_secret');

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(secretPath)) {
      const savedSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (savedSecret.length >= 32) {
        return { secret: savedSecret, source: 'file' };
      }
    }
    const newSecret = randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, newSecret, { encoding: 'utf8', mode: 0o600 });
    return { secret: newSecret, source: 'file' };
  } catch (err) {
    // If filesystem is somehow read-only, use an in-memory random secret for this process lifetime
    return { secret: randomBytes(48).toString('hex'), source: 'memory' };
  }
}

const { secret: resolvedSecret, source: resolvedSecretSource } = resolveSessionSecret();
const SESSION_SECRET = resolvedSecret;

/**
 * Where the active session signing secret came from: 'env' (SESSION_SECRET),
 * 'file' (persistent data/.session_secret) or 'memory' (volatile fallback).
 * Exposed so the server can log it at boot for instant environment diagnosis.
 */
export const sessionSecretSource: SessionSecretSource = resolvedSecretSource;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function signature(value: string): string {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function createSessionToken(principal: SessionPrincipal): string {
  const now = Math.floor(Date.now() / 1000);
  const encoded = base64UrlEncode(JSON.stringify({ ...principal, iat: now, exp: now + SESSION_TTL_SECONDS }));
  return encoded + '.' + signature(encoded);
}

function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [encoded, providedSignature] = token.split('.');
  if (!encoded || !providedSignature) return null;
  const expectedSignature = signature(encoded);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSession(req: Request): SessionPayload | null {
  const authorization = req.header('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const cookies = (req.headers.cookie || '').split(';').reduce<Record<string, string>>((all, part) => {
    const separator = part.indexOf('=');
    if (separator > 0) all[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1));
    return all;
  }, {});
  // Tenta o Bearer primeiro; se for inválido/antigo, cai para o cookie de sessão.
  // Um token antigo no localStorage não pode derrubar uma sessão de cookie válida.
  return verifyToken(bearer) ?? verifyToken(cookies[SESSION_COOKIE]);
}

export function setSessionCookie(res: Response, principal: SessionPrincipal, req?: Request): string {
  const token = createSessionToken(principal);
  const isHttps = Boolean(
    req && (req.secure || req.headers['x-forwarded-proto'] === 'https' || req.protocol === 'https')
  );
  // In HTTPS/iframe: SameSite=None; Secure; Partitioned
  // In plain HTTP (like direct IP 163.176.200.104): SameSite=Lax without Secure (otherwise browser rejects)
  const cookieFlags = isHttps
    ? '; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=' + SESSION_TTL_SECONDS
    : '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + SESSION_TTL_SECONDS;
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=' + encodeURIComponent(token) + cookieFlags);
  return token;
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const isHttps = Boolean(
    req && (req.secure || req.headers['x-forwarded-proto'] === 'https' || req.protocol === 'https')
  );
  const cookieFlags = isHttps
    ? '; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0'
    : '; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; Path=/; HttpOnly' + cookieFlags);
}

export function requireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      try {
        const users = await StorageService.loadUsers();
        if (users.length === 0) {
          return next();
        }
      } catch (_) {}

      if (!getSession(req)) return res.status(401).json({ error: 'Autenticação necessária. Faça login para continuar.' });
      next();
    })().catch(() => res.status(500).json({ error: 'Erro interno de autenticação.' }));
  };
}

export function requireSystemRole(...roles: SystemUserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    (async () => {
      try {
        const users = await StorageService.loadUsers();
        if (users.length === 0) {
          return next();
        }
      } catch (_) {}

      const session = getSession(req);
      if (!session) return res.status(401).json({ error: 'Autenticação necessária. Por favor, acesse com seu login de Administrador ou Operador.' });
      if (session.type !== 'system' || !roles.includes(session.role)) {
        return res.status(403).json({ error: 'Você não possui permissão para esta operação operacional.' });
      }
      next();
    })().catch(() => res.status(500).json({ error: 'Erro interno de autorização.' }));
  };
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(secret, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + derived;
}

export function verifySecret(stored: string | undefined, supplied: string): boolean {
  if (!stored || !supplied) return false;
  if (!stored.startsWith('scrypt$')) return stored === supplied;
  const [, salt, expectedHex] = stored.split('$');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(supplied, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function needsSecretMigration(stored: string | undefined): boolean {
  return Boolean(stored && !stored.startsWith('scrypt$'));
}
