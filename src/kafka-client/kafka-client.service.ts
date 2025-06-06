import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafkaProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';

@Injectable()
export class KafkaClientService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject('KAFKA_SERVICE') private client: ClientKafkaProxy) {}
  
  async onModuleInit() {
    this.client.subscribeToResponseOf('invoice.create_link');
    await this.client.connect();
  }

  onModuleDestroy() {
    this.client.close();
  }

  connect() {
    return this.client.connect();
  }

  subscribeToResponseOf(pattern: string) {
    this.client.subscribeToResponseOf(pattern);
  }

  send<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    return this.client.send(pattern, data);
  }

  emit<TResult = any, TInput = any>(
    pattern: any,
    data: TInput,
  ): Observable<TResult> {
    return this.client.emit(pattern, data);
  }
}
