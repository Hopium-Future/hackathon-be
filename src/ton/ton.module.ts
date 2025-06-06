import { Module } from '@nestjs/common';
import { TonService } from './ton.service';
import { TonController } from './ton.controller';
import { TonProofService } from './ton-proof.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { ConfigService } from '@nestjs/config';
import { Config, JwtConfig } from 'src/configuration/config.interface';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService<Config>) => {
        const jwtConfig = configService.get<JwtConfig>('jwt');
        return {
          global: false,
          secret: jwtConfig.secret,
          signOptions: { expiresIn: '5m' },
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [TonController],
  providers: [TonProofService, TonService],
})
export class TonModule {}
