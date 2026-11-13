export abstract class MailService {
  abstract sendInvitation(email: string, token: string, activationUrl: string): Promise<void>;
  abstract sendPasswordReset(email: string, token: string, resetUrl: string): Promise<void>;
}
