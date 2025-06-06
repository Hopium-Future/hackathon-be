import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Address, TonClient4 } from '@ton/ton';
import { Buffer } from 'buffer';
import { Config, TonConfig } from 'src/configuration/config.interface';

@Injectable()
export class TonService {
  private readonly tonClient: TonClient4;

  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly jwtService: JwtService,
  ) {
    const config = this.configService.get<TonConfig>('ton');

    this.tonClient = new TonClient4({
      endpoint: config.isMainnet
        ? 'https://mainnet-v4.tonhubapi.com'
        : 'https://testnet-v4.tonhubapi.com/',
    });
  }

  public async verifyToken(token: string): Promise<{ exp: number }> {
    try {
      const { exp } = await this.jwtService.verifyAsync(token);
      return { exp };
    } catch (error) {
      throw new UnauthorizedException('Invalid Token');
    }
  }

  public generateToken(payload: any): string {
    return this.jwtService.sign(payload);
  }

  /**
   * Get wallet public key by address.
   */
  public async getWalletPublicKey(address: string): Promise<Buffer> {
    const masterAt = await this.tonClient.getLastBlock();
    const result = await this.tonClient.runMethod(
      masterAt.last.seqno,
      Address.parse(address),
      'get_public_key',
      [],
    );

    return Buffer.from(
      result.reader.readBigNumber().toString(16).padStart(64, '0'),
      'hex',
    );
  }

  /**
   * Get account info by address.
   */
  public async getAccountInfo(
    address: string,
  ): Promise<ReturnType<TonClient4['getAccount']>> {
    const masterAt = await this.tonClient.getLastBlock();
    return await this.tonClient.getAccount(
      masterAt.last.seqno,
      Address.parse(address),
    );
  }
}
