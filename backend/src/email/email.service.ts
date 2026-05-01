import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly provider: 'console' | 'resend';

  constructor() {
    const configuredProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    this.provider = configuredProvider === 'resend' ? 'resend' : 'console';
    const resendApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
    if (this.provider === 'resend' && resendApiKey) {
      this.resend = new Resend(resendApiKey);
    }
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
      subject: 'Verify your email - Espace PMS',
      text: `Verify your email by opening this link: ${link}`,
      html: `<p>Verify your email to activate your account.</p><p><a href="${link}">Verify email</a></p>`,
      link,
    });
  }

  async sendWelcomeEmail(to: string) {
    await this.sendEmail({
      to,
      subject: 'Welcome to Espace PMS',
      text: 'Your account is now active. Welcome to Espace PMS!',
      html: '<p>Your account is now active. Welcome to <strong>Espace PMS</strong>!</p>',
    });
  }

  async sendResetPassword(to: string, link: string) {
    await this.sendEmail({
      to,
      subject: 'Reset your password - Espace PMS',
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
  }) {
    await this.sendEmail({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || `<p>${params.text}</p>`,
    });
  }

  isDeliveryConfigured() {
    if (this.provider === 'resend' && this.resend) return true;
    return !!this.getTransporter();
  }

  private async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
    link?: string;
  }) {
    const from = process.env.EMAIL_FROM || process.env.MAIL_FROM || 'Espace <no-reply@espace.local>';
    const replyTo = process.env.SUPPORT_EMAIL || undefined;

    if (this.provider === 'console') {
      this.logger.log(
        `[EMAIL] ${JSON.stringify({
          to: params.to,
          subject: params.subject,
          link: params.link || null,
        })}`,
      );
      return;
    }

    if (this.provider === 'resend' && this.resend) {
      try {
        await this.resend.emails.send({
          from,
          to: params.to,
          replyTo,
          subject: params.subject,
          html: params.html,
          text: params.text,
        });
        return;
      } catch (error) {
        this.logger.warn(`Resend failed, falling back to SMTP/log mode: ${(error as Error).message}`);
      }
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log(`[EMAIL_FALLBACK] ${params.subject} -> ${params.to}: ${params.text}`);
      return;
    }

    await transporter.sendMail({
      from,
      to: params.to,
      ...(replyTo ? { replyTo } : {}),
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}

