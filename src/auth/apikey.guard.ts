import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from 'src/configuration/config.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<Config>) {} // made up service for the point of the exmaple

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const key =
      req.headers['X-API-KEY'] ?? req.headers['x-api-key'] ?? req.query.api_key; // checks the header, moves to query if null
    const apiKey = this.configService.get('apiKey');
   
    return apiKey === key;
  }
}
