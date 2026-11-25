import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.resend.apiKey ? new Resend(env.resend.apiKey) : null;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#0b1f4b">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e3e8f0">
    <div style="font-size:20px;font-weight:700;margin-bottom:20px">MH Menu</div>
    <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="font-size:12px;color:#7a869a;margin-top:28px">MH Menu – Développé par MH Digital Solution</p>
  </div></body></html>`;
}

/**
 * Envoie un email via Resend. Sans clé API, rien n'est envoyé :
 * en développement on le signale en console, en production on lève une erreur.
 * Retourne true si l'email a été remis à Resend.
 */
export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    if (env.isProd) throw new Error('RESEND_API_KEY non configurée.');
    console.warn(`[mailer] RESEND_API_KEY absente : email "${subject}" non envoyé (destinataire ${to}).`);
    return false;
  }
  const { error } = await resend.emails.send({ from: env.resend.from, to, subject, html });
  if (error) throw new Error(`Resend : ${error.message}`);
  return true;
}

export function sendPasswordResetEmail({ to, name, resetUrl }) {
  const html = layout(
    'Réinitialisation de votre mot de passe',
    `<p style="line-height:1.6">Bonjour ${escapeHtml(name)},</p>
     <p style="line-height:1.6">Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure.</p>
     <p style="margin:24px 0"><a href="${escapeHtml(resetUrl)}" style="background:#0b1f4b;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Choisir un nouveau mot de passe</a></p>
     <p style="font-size:13px;color:#52607a;line-height:1.6">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email : votre mot de passe ne sera pas modifié.</p>`
  );
  return sendEmail({ to, subject: 'Réinitialisation de votre mot de passe MH Menu', html });
}

export function sendWelcomeEmail({ to, name, restaurantName, trialDays, dashboardUrl }) {
  const html = layout(
    `Bienvenue sur MH Menu, ${name}`,
    `<p style="line-height:1.6">Votre restaurant <strong>${escapeHtml(restaurantName)}</strong> est créé. Votre essai gratuit de ${trialDays} jours a commencé, sans carte bancaire.</p>
     <p style="margin:24px 0"><a href="${escapeHtml(dashboardUrl)}" style="background:#0b1f4b;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Accéder à mon tableau de bord</a></p>`
  );
  return sendEmail({ to, subject: 'Bienvenue sur MH Menu', html });
}
