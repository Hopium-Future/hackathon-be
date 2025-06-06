import { sha256 } from '@ton/crypto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/ton';
import { Injectable } from '@nestjs/common';
import { randomBytes, sign } from 'tweetnacl';
import { CheckProofDto } from './dto/check-proof.dto';
import { TonService } from './ton.service';
import { tryParsePublicKey } from './wrappers/wallets-data';
import { ConfigService } from '@nestjs/config';
import { Config, TonConfig } from 'src/configuration/config.interface';

const tonConnectPrefix = 'ton-connect';
const tonProofPrefix = 'ton-proof-item-v2/';

@Injectable()
export class TonProofService {
  private readonly validAuthTime: number;
  private readonly allowedDomains: string[];
  constructor(
    private readonly tonService: TonService,
    private readonly configService: ConfigService<Config>,
  ) {
    const config = this.configService.get<TonConfig>('ton');
    this.validAuthTime = config.validAuthTime;
    this.allowedDomains = config.allowedDomains;
  }

  /**
   * Generate a random payload.
   */
  public generatePayload(): string {
    const payload = Buffer.from(randomBytes(32)).toString('hex');
    return this.tonService.generateToken({ payload });
  }

  /**
   * Reference implementation of the checkProof method:
   * https://github.com/ton-blockchain/ton-connect/blob/main/requests-responses.md#address-proof-signature-ton_proof
   */
  public async checkProof(payload: CheckProofDto): Promise<boolean> {
    try {
      const stateInit = loadStateInit(
        Cell.fromBase64(payload.proof.stateInit).beginParse(),
      );
      // 1. First, try to obtain public key via get_public_key get-method on smart contract deployed at Address.
      // 2. If the smart contract is not deployed yet, or the get-method is missing, you need:
      //  2.1. Parse TonAddressItemReply.walletStateInit and get public key from stateInit. You can compare the walletStateInit.code
      //  with the code of standard wallets contracts and parse the data according to the found wallet version.
      let publicKey =
        tryParsePublicKey(stateInit) ??
        (await this.tonService.getWalletPublicKey(payload.address));
      if (!publicKey) {
        return false;
      }

      // 2.2. Check that TonAddressItemReply.publicKey equals to obtained public key
      const wantedPublicKey = Buffer.from(payload.publicKey, 'hex');
      if (!publicKey.equals(wantedPublicKey)) {
        return false;
      }

      // 2.3. Check that TonAddressItemReply.walletStateInit.hash() equals to TonAddressItemReply.address. .hash() means BoC hash.
      const wantedAddress = Address.parse(payload.address);
      const address = contractAddress(wantedAddress.workChain, stateInit);
      if (!address.equals(wantedAddress)) {
        return false;
      }

      if (!this.allowedDomains.includes(payload.proof.domain.value)) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      if (now - this.validAuthTime > payload.proof.timestamp) {
        return false;
      }

      const message = {
        workchain: address.workChain,
        address: address.hash,
        domain: {
          lengthBytes: payload.proof.domain.lengthBytes,
          value: payload.proof.domain.value,
        },
        signature: Buffer.from(payload.proof.signature, 'base64'),
        payload: payload.proof.payload,
        stateInit: payload.proof.stateInit,
        timestamp: payload.proof.timestamp,
      };

      const wc = Buffer.alloc(4);
      wc.writeUInt32BE(message.workchain, 0);

      const ts = Buffer.alloc(8);
      ts.writeBigUInt64LE(BigInt(message.timestamp), 0);

      const dl = Buffer.alloc(4);
      dl.writeUInt32LE(message.domain.lengthBytes, 0);

      const msg = Buffer.concat([
        Buffer.from(tonProofPrefix),
        wc,
        message.address,
        dl,
        Buffer.from(message.domain.value),
        ts,
        Buffer.from(message.payload),
      ]);

      const msgHash = Buffer.from(await sha256(msg));

      // signature = Ed25519Sign(privkey, sha256(0xffff ++ utf8_encode("ton-connect") ++ sha256(message)))
      const fullMsg = Buffer.concat([
        Buffer.from([0xff, 0xff]),
        Buffer.from(tonConnectPrefix),
        msgHash,
      ]);

      const result = Buffer.from(await sha256(fullMsg));

      return sign.detached.verify(result, message.signature, publicKey);
    } catch (e) {
      console.error('checkproof', e);
      return false;
    }
  }
}
