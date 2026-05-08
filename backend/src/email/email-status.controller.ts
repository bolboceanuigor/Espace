import { Controller, Get } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller()
export class EmailStatusController {
  constructor(private readonly emailService: EmailService) {}

  @Get(['system/email-status', 'api/system/email-status'])
  getEmailStatus() {
    return this.emailService.getDeliveryStatus();
  }
}
