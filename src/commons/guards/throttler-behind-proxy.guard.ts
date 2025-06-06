import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    console.log('ips', req.ips, req.ip);

    return req.ips.length > 1 ? req.ips[1] : req.ip; // individualize IP extraction to meet your own needs
  }
}
