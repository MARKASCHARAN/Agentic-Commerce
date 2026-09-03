import { Resend } from 'resend';
import { env } from '../../config/env.js';

export class ResendEmailProvider {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.providers.resendApiKey || 'dummy');
  }

  async sendEmail(to: string, subject: string, html: string): Promise<string> {
    if (!env.providers.resendApiKey) {
      console.warn(`[ResendEmailProvider] Mocking email send to ${to}. Subject: ${subject}`);
      return `mock_${Date.now()}`;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Agentic Commerce <onboarding@resend.dev>', // Must use verified domain or onboarding for testing
        to,
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data?.id || '';
    } catch (e: any) {
      console.error(`[ResendEmailProvider] Failed to send email to ${to}`, e);
      throw e;
    }
  }
}
