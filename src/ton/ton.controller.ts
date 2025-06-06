import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { TonService } from './ton.service';
import { TonProofService } from './ton-proof.service';
import { CheckProofDto } from './dto/check-proof.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { Address } from '@ton/core';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { Config, TonConfig } from 'src/configuration/config.interface';
import { TON_CHAIN } from './constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserHeader } from 'src/auth/type/auth.type';

@ApiBearerAuth()
@ApiTags('Ton')
@Controller('ton')
@UseGuards(AuthGuard, ThrottlerGuard)
export class TonController {
  constructor(
    private readonly tonService: TonService,
    private readonly tonProofService: TonProofService,
    private readonly userService: UsersService,
    private readonly configService: ConfigService<Config>,
  ) {}

  @Get('generate-payload')
  async generatePayload() {
    const payload = this.tonProofService.generatePayload();
    return { payload };
  }  

  @Post('connect')
  async connecWallet(@UserAuth() userData: UserHeader, @Body() body: CheckProofDto) {
    const tonConfig = this.configService.get<TonConfig>('ton');

    const network = tonConfig.isMainnet ? TON_CHAIN.MAINNET : TON_CHAIN.TESTNET;

    if (network !== body.network) {
      throw new UnauthorizedException('Invalid network');
    }

    await this.tonService.verifyToken(body.proof.payload);

    const isValid = await this.tonProofService.checkProof(body);

    if (!isValid) {
      throw new UnauthorizedException('Invalid proof');
    }

    const address = Address.parse(body.address).toRawString();

    return this.userService.connectTonWallet(userData.id, address);
  }
}
