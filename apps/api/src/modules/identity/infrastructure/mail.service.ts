import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../domain/mail.service';

export { MailService };

export interface SentMailRecord {
  type: 'INVITATION' | 'PASSWORD_RESET';
  email: string;
  token: string;
  url: string;
  sentAt: Date;
}

/** Keep the in-memory outbox bounded: it exists for tests/dev inspection only. */
const MAX_OUTBOX = 50;

@Injectable()
export class DevMailDriver extends MailService {
  private readonly logger = new Logger('DevMailDriver');
  private readonly sentMails: SentMailRecord[] = [];

  /**
   * No real mail is sent by this driver. Outside production the link is logged so a developer can
   * click it; in production a log line must never carry a working one-time link, so only the
   * recipient is recorded (the inviter gets the link from the API response instead).
   */
  private get exposeSecrets(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private remember(record: SentMailRecord): void {
    if (!this.exposeSecrets) return;
    this.sentMails.push(record);
    if (this.sentMails.length > MAX_OUTBOX) this.sentMails.shift();
  }

  async sendInvitation(email: string, token: string, activationUrl: string): Promise<void> {
    this.remember({ type: 'INVITATION', email, token, url: activationUrl, sentAt: new Date() });
    this.logger.log(
      this.exposeSecrets
        ? `\n==================================================\n[DevMailDriver] Invitation sent to: ${email}\nActivation URL: ${activationUrl}\n==================================================\n`
        : `[DevMailDriver] Invitation created for ${email} (no mail driver configured; link not logged)`,
    );
  }

  async sendPasswordReset(email: string, token: string, resetUrl: string): Promise<void> {
    this.remember({ type: 'PASSWORD_RESET', email, token, url: resetUrl, sentAt: new Date() });
    this.logger.log(
      this.exposeSecrets
        ? `\n==================================================\n[DevMailDriver] Password Reset sent to: ${email}\nReset URL: ${resetUrl}\n==================================================\n`
        : `[DevMailDriver] Password reset requested for ${email} (no mail driver configured; link not logged)`,
    );
  }

  getSentMails(): readonly SentMailRecord[] {
    return this.sentMails;
  }

  getLatestMail(email?: string): SentMailRecord | undefined {
    if (!email) {
      return this.sentMails[this.sentMails.length - 1];
    }
    return [...this.sentMails].reverse().find((m) => m.email.toLowerCase() === email.toLowerCase());
  }
}
