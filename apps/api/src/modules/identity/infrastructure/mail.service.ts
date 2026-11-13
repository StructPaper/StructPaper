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

@Injectable()
export class DevMailDriver extends MailService {
  private readonly logger = new Logger('DevMailDriver');
  private readonly sentMails: SentMailRecord[] = [];

  async sendInvitation(email: string, token: string, activationUrl: string): Promise<void> {
    const record: SentMailRecord = {
      type: 'INVITATION',
      email,
      token,
      url: activationUrl,
      sentAt: new Date(),
    };
    this.sentMails.push(record);
    this.logger.log(`\n==================================================\n[DevMailDriver] Invitation sent to: ${email}\nActivation URL: ${activationUrl}\n==================================================\n`);
  }

  async sendPasswordReset(email: string, token: string, resetUrl: string): Promise<void> {
    const record: SentMailRecord = {
      type: 'PASSWORD_RESET',
      email,
      token,
      url: resetUrl,
      sentAt: new Date(),
    };
    this.sentMails.push(record);
    this.logger.log(`\n==================================================\n[DevMailDriver] Password Reset sent to: ${email}\nReset URL: ${resetUrl}\n==================================================\n`);
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
