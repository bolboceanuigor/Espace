import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

type EmailDeliveryResult = {
  sent: boolean;
  provider: 'resend' | 'smtp' | null;
  warning?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly provider: 'console' | 'resend' | 'smtp' | 'disabled';

  constructor() {
    const resendApiKey = this.resendApiKey();
    const provider = this.resolveProvider();
    this.provider = provider;
    if (provider === 'resend' && resendApiKey) this.resend = new Resend(resendApiKey);
  }

  private getBaseAppUrl() {
    return (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true';

    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendVerifyEmail(to: string, link: string) {
    await this.sendEmail({
      to,
      subject: 'Verify your email - Espace',
      text: `Verify your email by opening this link: ${link}`,
      html: `<p>Verify your email to activate your account.</p><p><a href="${link}">Verify email</a></p>`,
      link,
    });
  }

  async sendWelcomeEmail(to: string) {
    await this.sendEmail({
      to,
      subject: 'Welcome to Espace',
      text: 'Your account is now active. Welcome to Espace!',
      html: '<p>Your account is now active. Welcome to <strong>Espace</strong>!</p>',
    });
  }

  async sendResetPassword(to: string, link: string) {
    await this.sendEmail({
      to,
      subject: 'Reset your password - Espace',
      text: `Reset password link: ${link}`,
      html: `<p>You requested a password reset.</p><p><a href="${link}">Reset password</a></p>`,
      link,
    });
  }

  async sendVerificationEmail(params: { email: string; locale: string; token: string }) {
    const link = `${this.getBaseAppUrl()}/${params.locale}/verify-email?token=${encodeURIComponent(params.token)}`;
    await this.sendVerifyEmail(params.email, link);
  }

  async sendPasswordResetEmail(params: { email: string; locale: string; token: string }) {
    const link = `${this.getBaseAppUrl()}/${params.locale}/reset-password?token=${encodeURIComponent(params.token)}`;
    await this.sendResetPassword(params.email, link);
  }

  async sendGenericEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailDeliveryResult> {
    return this.sendEmail({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || `<p>${params.text}</p>`,
    });
  }

  async sendInvitationEmail(params: {
    to: string;
    role: 'ADMIN' | 'RESIDENT' | string;
    activationLink: string;
    organizationName: string;
    invitedName?: string | null;
    expiresAt?: Date | string | null;
    apartmentNumber?: string | null;
  }): Promise<EmailDeliveryResult> {
    if (!this.isDeliveryConfigured()) {
      return {
        sent: false,
        provider: null,
        warning: 'Trimiterea emailului nu este configurată.',
      };
    }

    const isResident = String(params.role).toUpperCase() === 'RESIDENT';
    const invitedName = params.invitedName?.trim() || (isResident ? 'locatar' : 'administrator');
    const expiresAt = params.expiresAt
      ? new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium' }).format(new Date(params.expiresAt))
      : null;
    const subject = isResident ? 'Invitație locatar Espace' : 'Invitație administrator Espace';
    const safeName = this.escapeHtml(invitedName);
    const safeOrganization = this.escapeHtml(params.organizationName || 'A.P.C.');
    const safeLink = this.escapeHtml(params.activationLink);
    const safeApartment = this.escapeHtml(params.apartmentNumber || '');
    const safeExpiresAt = this.escapeHtml(expiresAt || '');

    const text = isResident
      ? [
          `Bună, ${invitedName},`,
          `Ai fost invitat să folosești aplicația Espace pentru ${params.organizationName}.`,
          params.apartmentNumber ? `Apartament: ${params.apartmentNumber}.` : '',
          'Vei putea vedea facturile, contoarele, cererile și avizierul.',
          `Activează contul aici: ${params.activationLink}`,
          expiresAt ? `Linkul expiră la ${expiresAt}.` : '',
          'Dacă nu ai solicitat această invitație, ignoră acest email.',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `Bună, ${invitedName},`,
          `Ai fost invitat să administrezi ${params.organizationName} în Espace.`,
          `Apasă pe link pentru a activa contul: ${params.activationLink}`,
          expiresAt ? `Linkul expiră la ${expiresAt}.` : '',
          'Dacă nu ai solicitat această invitație, ignoră acest email.',
        ]
          .filter(Boolean)
          .join('\n');

    const html = isResident
      ? `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033;">
          <p>Bună, ${safeName},</p>
          <p>Ai fost invitat să folosești aplicația <strong>Espace</strong> pentru ${safeOrganization}.</p>
          ${safeApartment ? `<p>Apartament: <strong>${safeApartment}</strong>.</p>` : ''}
          <p>Vei putea vedea facturile, contoarele, cererile și avizierul.</p>
          <p><a href="${safeLink}" style="display:inline-block;background:#172033;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700;">Activează contul</a></p>
          <p style="font-size:13px;color:#64748b;">${safeExpiresAt ? `Linkul expiră la ${safeExpiresAt}. ` : ''}Dacă nu ai solicitat această invitație, ignoră acest email.</p>
        </div>
      `
      : `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#172033;">
          <p>Bună, ${safeName},</p>
          <p>Ai fost invitat să administrezi <strong>${safeOrganization}</strong> în Espace.</p>
          <p><a href="${safeLink}" style="display:inline-block;background:#172033;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700;">Activează contul</a></p>
          <p style="font-size:13px;color:#64748b;">${safeExpiresAt ? `Linkul expiră la ${safeExpiresAt}. ` : ''}Dacă nu ai solicitat această invitație, ignoră acest email.</p>
        </div>
      `;

    return this.sendEmail({ to: params.to, subject, text, html });
  }

  isDeliveryConfigured() {
    if (this.provider === 'resend' && this.resend) return true;
    if (this.provider === 'smtp') return !!this.getTransporter();
    if (this.provider === 'console') return this.devMode();
    return false;
  }

  getDeliveryStatus() {
    const smtpConfigured = this.smtpConfigured();
    const resendConfigured = this.provider === 'resend' && !!this.resend;
    return {
      configured: this.isDeliveryConfigured(),
      provider: resendConfigured ? 'resend' : smtpConfigured ? 'smtp' : this.provider === 'console' && this.devMode() ? 'console' : null,
      from: process.env.EMAIL_FROM || process.env.MAIL_FROM || undefined,
    };
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    link?: string;
  }): Promise<EmailDeliveryResult> {
    const from = process.env.EMAIL_FROM || process.env.MAIL_FROM || 'Espace <no-reply@espace.md>';
    const replyTo = process.env.SUPPORT_EMAIL || undefined;
    const html = params.html || `<p>${this.escapeHtml(params.text)}</p>`;

    if (this.provider === 'console') {
      if (!this.devMode()) {
        throw new Error('Console email provider is disabled outside development mode.');
      }
      this.logger.log(
        `[EMAIL] ${JSON.stringify({
          to: params.to,
          subject: params.subject,
          provider: 'console',
        })}`,
      );
      return { sent: true, provider: null };
    }

    if (this.provider === 'resend' && this.resend) {
      try {
        await this.resend.emails.send({
          from,
          to: params.to,
          replyTo,
          subject: params.subject,
          html,
          text: params.text,
        });
        this.logger.log(`[EMAIL_SENT] ${JSON.stringify({ to: params.to, subject: params.subject, provider: 'resend' })}`);
        return { sent: true, provider: 'resend' };
      } catch (error) {
        this.logger.warn(`Resend failed for ${params.to} (${params.subject}): ${(error as Error).message}`);
      }
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`[EMAIL_NOT_CONFIGURED] ${JSON.stringify({ to: params.to, subject: params.subject })}`);
      throw new Error('Trimiterea emailului nu este configurată.');
    }

    await transporter.sendMail({
      from,
      to: params.to,
      ...(replyTo ? { replyTo } : {}),
      subject: params.subject,
      text: params.text,
      html,
    });
    this.logger.log(`[EMAIL_SENT] ${JSON.stringify({ to: params.to, subject: params.subject, provider: 'smtp' })}`);
    return { sent: true, provider: 'smtp' };
  }

  private resolveProvider(): 'console' | 'resend' | 'smtp' | 'disabled' {
    const explicit = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'resend') return this.resendApiKey() ? 'resend' : 'disabled';
    if (explicit === 'smtp') return this.smtpConfigured() ? 'smtp' : 'disabled';
    if (explicit === 'console') return this.devMode() ? 'console' : 'disabled';
    if (this.resendApiKey()) return 'resend';
    if (this.smtpConfigured()) return 'smtp';
    return this.devMode() ? 'console' : 'disabled';
  }

  private resendApiKey() {
    return process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || '';
  }

  private smtpConfigured() {
    return Boolean(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_PASS || process.env.SMTP_PASSWORD) && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD));
  }

  private devMode() {
    return String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
