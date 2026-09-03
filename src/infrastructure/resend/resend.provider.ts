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
        // Fallback for Resend test mode recipient restriction
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('only send testing emails') || msg.includes('invalid `to` field') || msg.includes('validation_error')) {
          console.warn(`[ResendEmailProvider] Recipient ${to} restricted in Resend sandbox mode. Redirecting alert to account owner markascharan@gmail.com.`);
          const fallback = await this.resend.emails.send({
            from: 'Agentic Commerce <onboarding@resend.dev>',
            to: 'markascharan@gmail.com',
            subject: `[Alert for ${to}] ${subject}`,
            html,
          });
          return fallback.data?.id || 'resend_sandbox_delivered';
        }
        throw new Error(error.message);
      }

      return data?.id || '';
    } catch (e: any) {
      console.warn(`[ResendEmailProvider] Email dispatch warning to ${to}: ${e.message}`);
      return `mock_${Date.now()}`;
    }
  }
}
