import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import config from '../config.js';
import { EmailMessage } from '../types.js';

export class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport(config.smtp);
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: config.smtp.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      console.log(`Email sent: ${info.messageId}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendOrderConfirmationEmail(
    orderId: string,
    userId: string,
    totalAmount: number,
    transactionId: string
  ): Promise<void> {
    // In a real application, you would fetch user email from a user service
    const userEmail = `user-${userId}@example.com`;

    const message: EmailMessage = {
      to: userEmail,
      subject: `Order Confirmation - Order #${orderId}`,
      text: `
        Thank you for your order!

        Order ID: ${orderId}
        Transaction ID: ${transactionId}
        Total Amount: $${totalAmount.toFixed(2)}

        Your order has been confirmed and is being processed.
        You will receive another email when your order ships.

        Thank you for shopping with us!
      `,
      html: `
        <html>
          <body>
            <h1>Thank you for your order!</h1>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
            <p>Your order has been confirmed and is being processed.</p>
            <p>You will receive another email when your order ships.</p>
            <p>Thank you for shopping with us!</p>
          </body>
        </html>
      `,
    };

    await this.sendEmail(message);
    console.log(`Order confirmation email sent for order ${orderId}`);
  }
}
