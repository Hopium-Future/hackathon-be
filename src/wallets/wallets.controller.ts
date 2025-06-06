import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WALLET_EVENTS } from './constants/events';
import { Wallet } from './interfaces/wallet.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

@ApiBearerAuth()
@ApiTags('Wallets')
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @MessagePattern(WALLET_EVENTS.UPDATED)
  async onUpdatedWallet(@Payload() wallet: Wallet) {
    this.eventEmitter.emit(WALLET_EVENTS.UPDATED, wallet);
  }
}
