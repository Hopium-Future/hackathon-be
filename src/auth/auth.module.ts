import { forwardRef, Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { AuthService } from './auth.service';
import { WalletsModule } from 'src/wallets/wallets.module';

@Global()
@Module({
  imports: [forwardRef(() => UsersModule), WalletsModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
